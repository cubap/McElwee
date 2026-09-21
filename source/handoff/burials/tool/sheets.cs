using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;

// Cuts the burial index into numbered, levelled, magnified reading strips.
//
// The mirrored photographs are ~92 DPI and tilted by up to 2.7 degrees. At that angle a
// line of type drifts about 28 pixels across the width of the card, which is why a naive
// crop of a row clips descenders and why plain OCR of these pages turns to mush. So each
// row is cropped with room for the drift, rotated level, contrast-stretched, magnified,
// and stacked onto a sheet with its sequence number printed in the gutter. The reader is
// never asked to find a row; it is asked what row 14 says.
public static class SheetMaker
{
    class Row
    {
        public int seq, y0, y1, bandH;
        public string kind;
    }

    class Page
    {
        public string id, image;
        public double skew;
        public int w, h;
        public List<Row> rows = new List<Row>();
    }

    public static string Run(string tsvPath, string outDir, int maxRows, int maxSheetH, int gutter, int targetW)
    {
        if (!Directory.Exists(outDir)) Directory.CreateDirectory(outDir);
        else foreach (var f in Directory.GetFiles(outDir, "*.png")) File.Delete(f);

        var order = new List<string>();
        var pages = new Dictionary<string, Page>();
        foreach (var line in File.ReadAllLines(tsvPath))
        {
            if (string.IsNullOrEmpty(line.Trim())) continue;
            var c = line.Split('\t');
            if (c.Length < 9) continue;
            Page p;
            if (!pages.TryGetValue(c[0], out p))
            {
                p = new Page { id = c[0], image = c[1], skew = double.Parse(c[2], System.Globalization.CultureInfo.InvariantCulture), w = int.Parse(c[3]), h = int.Parse(c[4]) };
                pages[c[0]] = p;
                order.Add(c[0]);
            }
            p.rows.Add(new Row { seq = int.Parse(c[5]), y0 = int.Parse(c[6]), y1 = int.Parse(c[7]), kind = c[8] });
        }

        var manifest = new List<string>();
        int totalSheets = 0, totalRows = 0;

        foreach (var id in order)
        {
            var p = pages[id];
            if (!File.Exists(p.image)) { Console.WriteLine("MISSING " + p.image); continue; }

            using (var src = new Bitmap(p.image))
            {
                double drift = Math.Abs(Math.Tan(p.skew * Math.PI / 180.0)) * (src.Width / 2.0);
                int pad = (int)Math.Ceiling(drift) + 6;
                double scale = Math.Min(3.0, (double)targetW / src.Width);
                int margin = 14;
                int sheetW = gutter + (int)(src.Width * scale) + margin * 2;

                var strips = new List<Bitmap>();
                foreach (var r in p.rows)
                {
                    int top = Math.Max(0, r.y0 - pad);
                    int bot = Math.Min(src.Height - 1, r.y1 + pad);
                    int sh = bot - top + 1;
                    r.bandH = Math.Min(sh, (r.y1 - r.y0 + 1) + 12);
                    strips.Add(Level(src, top, sh, p.skew, r.bandH, scale));
                }

                int idx = 0, i = 0;
                while (i < strips.Count)
                {
                    int y = margin + 26;
                    int j = i;
                    while (j < strips.Count && (j - i) < maxRows)
                    {
                        int next = y + strips[j].Height + 6;
                        if (j > i && next > maxSheetH - margin) break;
                        y = next; j++;
                    }
                    if (j == i) j = i + 1;

                    int sheetH = y + margin;
                    idx++;
                    string file = id + "_s" + idx.ToString("D2") + ".png";
                    using (var sheet = new Bitmap(sheetW, sheetH, PixelFormat.Format24bppRgb))
                    {
                        using (var g = Graphics.FromImage(sheet))
                        {
                            g.Clear(Color.White);
                            g.TextRenderingHint = TextRenderingHint.AntiAlias;
                            using (var font = new Font("Consolas", 15f, FontStyle.Regular))
                            using (var head = new Font("Consolas", 11f, FontStyle.Bold))
                            using (var brush = new SolidBrush(Color.FromArgb(30, 30, 30)))
                            using (var rule = new Pen(Color.FromArgb(200, 200, 200)))
                            {
                                g.DrawString(p.id + "   seq " + p.rows[i].seq + "-" + p.rows[j - 1].seq, head, brush, margin, 4);
                                g.DrawLine(rule, gutter - 8, 24, gutter - 8, sheetH - margin);
                                int cy = margin + 26;
                                for (int k = i; k < j; k++)
                                {
                                    var b = strips[k];
                                    g.DrawImage(b, new Rectangle(margin + gutter, cy, b.Width, b.Height));
                                    string label = p.rows[k].kind == "prose" ? p.rows[k].seq + "~" : p.rows[k].seq.ToString();
                                    var sz = g.MeasureString(label, font);
                                    g.DrawString(label, font, brush, margin + gutter - 12 - sz.Width, cy + (b.Height - sz.Height) / 2f);
                                    if (k > i) g.DrawLine(rule, margin, cy - 3, sheetW - margin, cy - 3);
                                    cy += b.Height + 6;
                                }
                            }
                        }
                        sheet.Save(Path.Combine(outDir, file), ImageFormat.Png);
                    }
                    var names = new List<string>();
                    for (int k = i; k < j; k++) names.Add(p.rows[k].seq.ToString());
                    manifest.Add("{\"page\":\"" + id + "\",\"sheet\":\"" + file + "\",\"width\":" + sheetW + ",\"height\":" + sheetH + ",\"seq\":[" + string.Join(",", names.ToArray()) + "]}");
                    totalSheets++; totalRows += (j - i);
                    i = j;
                }
                foreach (var b in strips) b.Dispose();
            }
        }

        Console.WriteLine("sheets: " + totalSheets + "  rows placed: " + totalRows);
        return "[" + string.Join(",", manifest.ToArray()) + "]";
    }

    // Crop a full-width strip, rotate it so the type runs level, take the middle band,
    // and magnify. The band is centred on the strip, which is where the line sits once the
    // slant is removed, so neighbouring rows rotate out of it instead of into it.
    static Bitmap Level(Bitmap src, int top, int sh, double skew, int bandH, double scale)
    {
        int W = src.Width;
        int grow = (int)(Math.Abs(Math.Tan(skew * Math.PI / 180.0)) * (W / 2.0)) + 4;
        int canvasH = sh + grow * 2;
        using (var canvas = new Bitmap(W, canvasH, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(canvas))
            {
                g.Clear(Color.White);
                g.DrawImage(src, new Rectangle(0, grow, W, sh), new Rectangle(0, top, W, sh), GraphicsUnit.Pixel);
            }
            using (var flat = new Bitmap(W, canvasH, PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(flat))
                {
                    g.Clear(Color.White);
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.TranslateTransform(W / 2f, canvasH / 2f);
                    g.RotateTransform((float)(-skew));
                    g.TranslateTransform(-W / 2f, -canvasH / 2f);
                    g.DrawImage(canvas, 0, 0);
                }
                int bandTop = (canvasH - bandH) / 2;
                var outBmp = new Bitmap((int)(W * scale), (int)(bandH * scale), PixelFormat.Format24bppRgb);
                using (var g = Graphics.FromImage(outBmp))
                {
                    g.Clear(Color.White);
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.DrawImage(flat, new Rectangle(0, 0, outBmp.Width, outBmp.Height), new Rectangle(0, bandTop, W, bandH), GraphicsUnit.Pixel);
                }
                Stretch(outBmp);
                return outBmp;
            }
        }
    }

    // Linear contrast stretch on luminance percentiles. Typewriter carbon sits in a narrow
    // band of greys and loses its faint strokes without it.
    static void Stretch(Bitmap bmp)
    {
        var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
        var d = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format24bppRgb);
        try
        {
            int bytes = Math.Abs(d.Stride) * d.Height;
            var buf = new byte[bytes];
            System.Runtime.InteropServices.Marshal.Copy(d.Scan0, buf, 0, bytes);
            var hist = new int[256];
            for (int i = 0; i < bytes; i++) hist[buf[i]]++;
            int n = bytes / 3;
            int lo = 0, hi = 255, acc = 0;
            for (int v = 0; v < 256; v++) { acc += hist[v] / 3; if (acc >= n * 0.01) { lo = v; break; } }
            acc = 0;
            for (int v = 255; v >= 0; v--) { acc += hist[v] / 3; if (acc >= n * 0.01) { hi = v; break; } }
            if (hi - lo < 40) return;
            double span = 255.0 / (hi - lo);
            for (int i = 0; i < bytes; i++)
            {
                int v = (int)((buf[i] - lo) * span);
                buf[i] = (byte)(v < 0 ? 0 : (v > 255 ? 255 : v));
            }
            System.Runtime.InteropServices.Marshal.Copy(buf, 0, d.Scan0, bytes);
        }
        finally { bmp.UnlockBits(d); }
    }
}

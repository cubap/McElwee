using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// Row-segmented line extraction with adaptive (Sauvola) binarisation.
//
// The scans are photographs, not flatbed scans: lighting falls off across the page, so
// a single global threshold calls the shaded background "ink" and the row profile never
// shows a gap. Sauvola thresholds each pixel against the local mean and standard
// deviation, which cancels the gradient and leaves clean text/no-text separation.
// That fix is what makes line segmentation -- and therefore line-level OCR -- possible.
public static class ScanSegmenter
{
    public static string Run(string srcDir, string outDir, int minBandH, int mergeGap, int targetH,
                             int radius, double k, bool binarise, double floorMul)
    {
        Directory.CreateDirectory(outDir);
        var sb = new StringBuilder();
        sb.Append("[");
        bool firstPage = true;

        foreach (var path in Directory.GetFiles(srcDir, "*.jpg"))
        {
            var name = Path.GetFileNameWithoutExtension(path);
            using (var src = new Bitmap(path))
            {
                double angle = EstimateSkew(src);
                using (var flat = Rotate(src, angle))
                {
                    int W = flat.Width, H = flat.Height;
                    byte[] gray = ToGray(flat);
                    int mx = (W - src.Width) / 2, my = (H - src.Height) / 2;

                    byte[] bin = Sauvola(gray, W, H, radius, k);

                    var ink = new int[H];
                    for (int y = 0; y < H; y++)
                    {
                        int c = 0, o = y * W;
                        for (int x = 0; x < W; x++) if (bin[o + x] == 1) c++;
                        ink[y] = c;
                    }

                    int top = my + 6, bot = H - my - 6;
                    if (bot <= top) { top = 0; bot = H; }

                    // The inter-line gaps are not zero: Sauvola still leaves a light speckle
                    // floor (typically ~11 px/row here). Cut just above that floor. Using the
                    // median overshoots on dense pages, where most rows are text rows, so take
                    // a low percentile as the noise level and double it.
                    var span = new List<int>();
                    for (int y = top; y < bot; y++) span.Add(ink[y]);
                    span.Sort();
                    double p10 = span.Count > 0 ? span[(int)(span.Count * 0.10)] : 0;
                    int floor = Math.Max(12, (int)(p10 * floorMul));

                    var bands = new List<int[]>();
                    int start = -1;
                    for (int y = top; y < bot; y++)
                    {
                        bool on = ink[y] > floor;
                        if (on && start < 0) start = y;
                        if (!on && start >= 0) { bands.Add(new int[] { start, y - 1 }); start = -1; }
                    }
                    if (start >= 0) bands.Add(new int[] { start, bot - 1 });

                    var merged = new List<int[]>();
                    foreach (var b in bands)
                    {
                        if (merged.Count > 0 && b[0] - merged[merged.Count - 1][1] <= mergeGap)
                            merged[merged.Count - 1][1] = b[1];
                        else merged.Add(new int[] { b[0], b[1] });
                    }

                    // Where two lines touch (a descender crossing a rule, or a dark page),
                    // the profile never reaches the floor and they fuse into one tall band.
                    // Split those at their deepest internal trough instead of giving up.
                    var pitches = new List<int>();
                    foreach (var b in merged) pitches.Add(b[1] - b[0] + 1);
                    pitches.Sort();
                    int pitch = pitches.Count > 0 ? pitches[pitches.Count / 2] : 20;
                    var split = new List<int[]>();
                    foreach (var b in merged) SplitTall(b, ink, top, bot, pitch, split);
                    merged = split;

                    if (!firstPage) sb.Append(",");
                    firstPage = false;
                    sb.Append("{\"page\":\"").Append(name).Append("\",\"skew\":")
                      .Append(angle.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture))
                      .Append(",\"bands\":[");

                    int idx = 0;
                    foreach (var b in merged)
                    {
                        int h = b[1] - b[0] + 1;
                        if (h < minBandH || h > targetH * 2) continue;

                        double s = (double)targetH / h;
                        if (s > 8) s = 8;
                        int pad = 20;
                        int nw = (int)(W * s) + pad * 2;
                        int nh = (int)(h * s) + pad * 2;

                        using (var band = new Bitmap(nw, nh, PixelFormat.Format32bppArgb))
                        {
                            using (var g = Graphics.FromImage(band))
                            {
                                g.Clear(Color.White);
                                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                                if (binarise)
                                {
                                    using (var bm = BuildBin(bin, W, H, b[0], h))
                                        g.DrawImage(bm, new Rectangle(pad, pad, (int)(W * s), (int)(h * s)),
                                                    new Rectangle(0, 0, W, h), GraphicsUnit.Pixel);
                                }
                                else
                                {
                                    g.DrawImage(flat, new Rectangle(pad, pad, (int)(W * s), (int)(h * s)),
                                                new Rectangle(0, b[0], W, h), GraphicsUnit.Pixel);
                                    Stretch(band);
                                }
                            }
                            string outPath = Path.Combine(outDir, name + "_r" + idx.ToString("D3") + ".png");
                            band.Save(outPath, ImageFormat.Png);
                            if (idx > 0) sb.Append(",");
                            // Emit the scale and pad so a consumer can map OCR word x back to
                            // source-page pixels; band widths differ per page (skew grows the
                            // canvas), so a fraction of band width is not a stable column test.
                            sb.Append("{\"file\":\"").Append(Path.GetFileName(outPath))
                              .Append("\",\"y0\":").Append(b[0] - my)
                              .Append(",\"y1\":").Append(b[1] - my)
                              .Append(",\"scale\":").Append(s.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture))
                              .Append(",\"pad\":").Append(pad).Append("}");
                            idx++;
                        }
                    }
                    sb.Append("]}");
                }
            }
        }
        sb.Append("]");
        return sb.ToString();
    }

    // Recursively cut an over-tall band at the shallowest trough near one line-pitch in.
    static void SplitTall(int[] b, int[] ink, int top, int bot, int pitch, List<int[]> outBands)
    {
        int h = b[1] - b[0] + 1;
        if (pitch < 6 || h <= (int)(pitch * 1.6) || h < 10)
        {
            outBands.Add(b);
            return;
        }
        int lo = b[0] + (int)(pitch * 0.6), hi = b[0] + (int)(pitch * 1.45);
        if (lo <= b[0]) lo = b[0] + 2;
        if (hi >= b[1]) hi = b[1] - 2;
        if (hi <= lo) { outBands.Add(b); return; }

        int cut = lo, bestVal = int.MaxValue;
        // Prefer a trough that is also a local minimum, smoothed over a 3-row window.
        for (int y = lo; y <= hi; y++)
        {
            int v = ink[y];
            if (y > top && y < bot - 1) v = (ink[y - 1] + v + ink[y + 1]) / 3;
            if (v < bestVal) { bestVal = v; cut = y; }
        }
        SplitTall(new int[] { b[0], cut }, ink, top, bot, pitch, outBands);
        SplitTall(new int[] { cut + 1, b[1] }, ink, top, bot, pitch, outBands);
    }

    static Bitmap BuildBin(byte[] bin, int W, int H, int y0, int h)
    {
        var bmp = new Bitmap(W, h, PixelFormat.Format32bppArgb);
        var d = bmp.LockBits(new Rectangle(0, 0, W, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        var buf = new byte[d.Stride * h];
        for (int i = 3; i < buf.Length; i += 4) buf[i] = 255;
        for (int y = 0; y < h; y++)
            for (int x = 0; x < W; x++)
            {
                int i = y * d.Stride + x * 4;
                byte v = bin[(y0 + y) * W + x] == 1 ? (byte)0 : (byte)255;
                buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255;
            }
        Marshal.Copy(buf, 0, d.Scan0, buf.Length);
        bmp.UnlockBits(d);
        return bmp;
    }

    // Sauvola: T = m * (1 + k * (s / R - 1)). Integral images make the local moments O(1).
    static byte[] Sauvola(byte[] gray, int W, int H, int radius, double k)
    {
        var sum = new double[(W + 1) * (H + 1)];
        var sq = new double[(W + 1) * (H + 1)];
        for (int y = 0; y < H; y++)
        {
            double rowSum = 0, rowSq = 0;
            int cur = (y + 1) * (W + 1), prev = y * (W + 1);
            for (int x = 0; x < W; x++)
            {
                int g = gray[y * W + x];
                rowSum += g; rowSq += (double)g * g;
                sum[cur + x + 1] = sum[prev + x + 1] + rowSum;
                sq[cur + x + 1] = sq[prev + x + 1] + rowSq;
            }
        }
        var outp = new byte[W * H];
        double R = 128.0;
        for (int y = 0; y < H; y++)
        {
            int y0 = Math.Max(0, y - radius), y1 = Math.Min(H - 1, y + radius);
            for (int x = 0; x < W; x++)
            {
                int x0 = Math.Max(0, x - radius), x1 = Math.Min(W - 1, x + radius);
                int area = (y1 - y0 + 1) * (x1 - x0 + 1);
                double s = sum[(y1 + 1) * (W + 1) + x1 + 1] - sum[y0 * (W + 1) + x1 + 1]
                         - sum[(y1 + 1) * (W + 1) + x0] + sum[y0 * (W + 1) + x0];
                double s2 = sq[(y1 + 1) * (W + 1) + x1 + 1] - sq[y0 * (W + 1) + x1 + 1]
                          - sq[(y1 + 1) * (W + 1) + x0] + sq[y0 * (W + 1) + x0];
                double m = s / area;
                double var = s2 / area - m * m;
                if (var < 0) var = 0;
                double sd = Math.Sqrt(var);
                double t = m * (1.0 + k * (sd / R - 1.0));
                outp[y * W + x] = (byte)(gray[y * W + x] < t ? 1 : 0);
            }
        }
        return outp;
    }

    static void Stretch(Bitmap bmp)
    {
        var d = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var buf = new byte[d.Stride * bmp.Height];
        Marshal.Copy(d.Scan0, buf, 0, buf.Length);
        var hist = new int[256];
        for (int i = 0; i < buf.Length; i += 4) hist[buf[i + 2]]++;
        long total = (long)bmp.Width * bmp.Height;
        int clip = (int)(total * 0.02);
        int lo = 0; long acc = 0; while (lo < 255 && acc < clip) { acc += hist[lo]; lo++; }
        int hi = 255; acc = 0; while (hi > lo && acc < clip) { acc += hist[hi]; hi--; }
        int span = Math.Max(1, hi - lo);
        for (int i = 0; i < buf.Length; i += 4)
        {
            int o = ((buf[i + 2] - lo) * 255) / span;
            o = Math.Max(0, Math.Min(255, o));
            buf[i] = (byte)o; buf[i + 1] = (byte)o; buf[i + 2] = (byte)o; buf[i + 3] = 255;
        }
        Marshal.Copy(buf, 0, d.Scan0, buf.Length);
        bmp.UnlockBits(d);
    }

    static byte[] ToGray(Bitmap bmp)
    {
        int W = bmp.Width, H = bmp.Height;
        var g = new byte[W * H];
        var d = bmp.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        var buf = new byte[d.Stride * H];
        Marshal.Copy(d.Scan0, buf, 0, buf.Length);
        bmp.UnlockBits(d);
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                int i = y * d.Stride + x * 4;
                g[y * W + x] = (byte)Math.Min(255, (int)(0.299 * buf[i + 2] + 0.587 * buf[i + 1] + 0.114 * buf[i]));
            }
        return g;
    }

    static int Otsu(byte[] gray)
    {
        var hist = new int[256];
        foreach (var v in gray) hist[v]++;
        int n = gray.Length;
        double total = 0; for (int i = 0; i < 256; i++) total += i * hist[i];
        double sumB = 0; int wB = 0; double best = -1; int thr = 128;
        for (int t = 0; t < 256; t++)
        {
            wB += hist[t]; if (wB == 0) continue;
            int wF = n - wB; if (wF == 0) break;
            sumB += t * hist[t];
            double mB = sumB / wB, mF = (total - sumB) / wF;
            double between = (double)wB * wF * (mB - mF) * (mB - mF);
            if (between > best) { best = between; thr = t; }
        }
        return thr;
    }

    static double EstimateSkew(Bitmap src)
    {
        int dw = 300, dh = Math.Max(1, (int)((double)src.Height / src.Width * dw));
        byte[] gray = GrayDown(src, dw, dh);
        int t = Otsu(gray);
        var bin = new byte[gray.Length];
        for (int i = 0; i < gray.Length; i++) bin[i] = (byte)(gray[i] < t ? 1 : 0);
        double best = 0, score = double.MinValue;
        for (double a = -6; a <= 6.001; a += 0.5)
        { double s = Scan(bin, dw, dh, a); if (s > score) { score = s; best = a; } }
        for (double a = best - 0.5; a <= best + 0.501; a += 0.1)
        { double s = Scan(bin, dw, dh, a); if (s > score) { score = s; best = a; } }
        return best;
    }

    static double Scan(byte[] bin, int w, int h, double deg)
    {
        double rad = deg * Math.PI / 180.0, cos = Math.Cos(rad), sin = Math.Sin(rad);
        double cx = w / 2.0, cy = h / 2.0;
        var rows = new long[h];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                double dx = x - cx, dy = y - cy;
                int sx = (int)Math.Round(cx + dx * cos - dy * sin);
                int sy = (int)Math.Round(cy + dx * sin + dy * cos);
                if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
                if (bin[sy * w + sx] == 1) rows[y]++;
            }
        double sum = 0;
        for (int y = 0; y < h; y++) sum += (double)rows[y] * rows[y];
        return sum;
    }

    static byte[] GrayDown(Bitmap src, int w, int h)
    {
        var outBuf = new byte[w * h];
        using (var small = new Bitmap(w, h, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(small))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(src, new Rectangle(0, 0, w, h));
            }
            var d = small.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            var buf = new byte[d.Stride * h];
            Marshal.Copy(d.Scan0, buf, 0, buf.Length);
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    int i = y * d.Stride + x * 4;
                    outBuf[y * w + x] = (byte)((0.299 * buf[i + 2] + 0.587 * buf[i + 1] + 0.114 * buf[i]));
                }
            small.UnlockBits(d);
        }
        return outBuf;
    }

    static Bitmap Rotate(Bitmap src, double deg)
    {
        if (Math.Abs(deg) < 0.05) return new Bitmap(src);
        double rad = deg * Math.PI / 180.0;
        double cos = Math.Abs(Math.Cos(rad)), sin = Math.Abs(Math.Sin(rad));
        int nw = (int)Math.Ceiling(src.Width * cos + src.Height * sin);
        int nh = (int)Math.Ceiling(src.Width * sin + src.Height * cos);
        var o = new Bitmap(nw, nh, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(o))
        {
            g.Clear(Color.White);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TranslateTransform(nw / 2.0f, nh / 2.0f);
            g.RotateTransform((float)deg);
            g.TranslateTransform(-src.Width / 2.0f, -src.Height / 2.0f);
            g.DrawImage(src, new Rectangle(0, 0, src.Width, src.Height));
        }
        return o;
    }
}

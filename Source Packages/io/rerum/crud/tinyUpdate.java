/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package io.rerum.crud;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ResourceBundle;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import net.sf.json.JSONObject;
import io.rerum.tokens.TinyTokenManager;


/**
 *
 * @author bhaberbe
 */
public class tinyUpdate extends HttpServlet {
    //private final TinyTokenManager manager = new TinyTokenManager("E:\\tinyThings\\Source Packages\\tiny.properties");

    /**
     * Processes requests for both HTTP <code>GET</code> and <code>POST</code>
     * methods.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
        protected void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException, Exception {
        
        TinyTokenManager manager = new TinyTokenManager();
        BufferedReader bodyReader = request.getReader();
        StringBuilder bodyString = new StringBuilder();
        String line;
        JSONObject requestJSON = new JSONObject();
        String requestString;
        boolean moveOn = false;
        
        //Gather user provided parameters from BODY of request, not parameters
        while ((line = bodyReader.readLine()) != null)
        {
          bodyString.append(line);
        }
        requestString = bodyString.toString();
        try{ 
            //JSONObject test
            requestJSON = JSONObject.fromObject(requestString);
            moveOn = true;
        }
        catch(Exception ex){
            response.getWriter().print("Your provided content must be JSON");
        }
        
        //If it was JSON
        if(moveOn){
            //Get public token for requests from property file
            String pubTok = manager.getAccessToken();
            boolean expired = manager.checkTokenExpiry();
            if(expired){
                System.out.println("Tiny thing detected an expired token, auto getting and setting a new one...");
                pubTok = manager.generateNewAccessToken();
            }
            //Point to rerum server v1
            URL postUrl = new URL(Constant.RERUM_API_ADDR + "/update.action");
            HttpURLConnection connection = (HttpURLConnection) postUrl.openConnection();
            connection.setDoOutput(true);
            connection.setDoInput(true);
            connection.setRequestMethod("PUT");
            connection.setUseCaches(false);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Authorization", "Bearer "+pubTok);
            connection.connect();
            DataOutputStream out = new DataOutputStream(connection.getOutputStream());
            //Pass in the user provided JSON for the body of the rerumserver v1 request
            out.writeBytes(requestJSON.toString());
            out.flush();
            out.close(); 
            //Execute rerum server v1 request
            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(),"utf-8"));
            StringBuilder sb = new StringBuilder();
            while ((line = reader.readLine()) != null){
                //Gather rerum server v1 response
                sb.append(line);
            }
            reader.close();
            int code = connection.getResponseCode();
            connection.disconnect();
            //Hand back rerumserver response as this API's response.
            response.setStatus(code);
            response.setContentType("application/json");
            response.getWriter().print(sb.toString());
        }
        
    }

    // <editor-fold defaultstate="collapsed" desc="HttpServlet methods. Click on the + sign on the left to edit the code.">
    /**
     * Handles the HTTP <code>GET</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        try {
            processRequest(request, response);
        } catch (Exception ex) {
            Logger.getLogger(tinyUpdate.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    /**
     * Handles the HTTP <code>PUT</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        try {
            processRequest(request, response);
        } catch (Exception ex) {
            Logger.getLogger(tinyUpdate.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    /**
     * Returns a short description of the servlet.
     *
     * @return a String containing servlet description
     */
    @Override
    public String getServletInfo() {
        return "Short description";
    }// </editor-fold>

}

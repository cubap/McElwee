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
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.servlet.ServletContextEvent;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import io.rerum.tokens.TinyTokenManager;

/**
 *
 * @author bhaberbe
 */
public class tinyDelete extends HttpServlet {    
    
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
        manager.init();
        BufferedReader bodyReader = request.getReader();
        StringBuilder bodyString = new StringBuilder();
        String line;
        String requestString;
        while ((line = bodyReader.readLine()) != null)
        {
          bodyString.append(line);
        }
        requestString = bodyString.toString();
        if(!requestString.contains(Constant.RERUM_ID_PATTERN)){
            //IT IS NOT a rerum object, we can't delete this
            request.sendError(HttpServletResponse.SC_BAD_REQUEST,"Your provided id must be a RERUM URL. Pattern \""+Constant.RERUM_ID_PATTERN+"\" was not found.");
            // If we throw instead, the return isn't needed.
            return;
        }
        //If it was JSON
            String pubTok = manager.getAccessToken();
            boolean expired = manager.checkTokenExpiry();
            if(expired){
                System.out.println("Tiny thing detected an expired token, auto getting and setting a new one...");
                pubTok = manager.generateNewAccessToken();
            }
            //Point to rerum server v1
            URL postUrl = new URL(Constant.RERUM_API_ADDR + "/delete.action");
            HttpURLConnection connection = (HttpURLConnection) postUrl.openConnection();
            connection.setDoOutput(true);
            connection.setDoInput(true);
            connection.setRequestMethod("DELETE");
            connection.setUseCaches(false);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Authorization", "Bearer "+pubTok);
            connection.connect();
            DataOutputStream out = new DataOutputStream(connection.getOutputStream());
            //Pass in the user provided JSON for the body of the rerumserver v1 request
            out.writeBytes(requestString);
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
            // https://github.com/CenterForDigitalHumanities/TinyThings/issues/4
            // Should we check `code` for 204? Throw something?
            response.setStatus(code);
            response.setContentType("application/json");
            response.getWriter().print(sb.toString());
    }

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
            Logger.getLogger(tinyDelete.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    /**
     * Handles the HTTP <code>DELETE</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        try {
            processRequest(request, response);
        } catch (Exception ex) {
            Logger.getLogger(tinyDelete.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    /**
     * Returns a short description of the servlet.
     *
     * @return a String containing servlet description
     */
    @Override
    public String getServletInfo() {
        return "Mark an object at a known `id` as deleted, removing it from the version history.";
    }// </editor-fold>

}

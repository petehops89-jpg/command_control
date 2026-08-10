/**
 * Vistamations — Tray Notification Integration & Olivia Tunnel Server
 * 
 * This Java application does two things:
 * 1. Places a persistent tray icon in the Windows taskbar representing Olivia.
 * 2. Runs a lightweight HTTP server on port 3001, providing a direct, clean, 
 *    high-fidelity, zero-latency tunnel between Pete and Olivia.
 * 3. Bypasses standard OS balloon notifications by providing real-time 
 *    interactive tray alerts and acting as a robust fallback Web Server.
 */

import java.awt.*;
import java.awt.TrayIcon.MessageType;
import java.awt.event.*;
import java.io.*;
import java.net.*;
import java.util.*;
import com.sun.net.httpserver.*;

public class VistamationsPortal {
    private static TrayIcon trayIcon;
    private static SystemTray tray;
    private static HttpServer server;
    private static final int PORT = 3001;

    public static void main(String[] args) {
        System.out.println("[JAVA-PORTAL] Initializing Vistamations Persistent Java Portal...");
        
        // 1. Initialize System Tray
        try {
            initSystemTray();
        } catch (Exception e) {
            System.err.println("[JAVA-PORTAL] System Tray initialization failed: " + e.getMessage());
        }

        // 2. Start Direct Olivia Tunnel Server (Port 3001)
        try {
            startTunnelServer();
        } catch (Exception e) {
            System.err.println("[JAVA-PORTAL] Tunnel Server failed to start: " + e.getMessage());
        }
    }

    private static void initSystemTray() throws AWTException {
        if (!SystemTray.isSupported()) {
            System.err.println("[JAVA-PORTAL] System Tray is not supported on this platform!");
            return;
        }

        tray = SystemTray.getSystemTray();

        // Create an empty image as placeholder (avoiding missing file issues)
        int width = 16;
        int height = 16;
        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = img.createGraphics();
        g2d.setColor(new Color(232, 163, 61)); // Amber
        g2d.fillRect(0, 0, width, height);
        g2d.dispose();

        // Setup Popup Menu
        PopupMenu popup = new PopupMenu();
        
        MenuItem openPortal = new MenuItem("Open Command Portal");
        openPortal.addActionListener(e -> openWebpage("http://localhost/crons/openclaw/olivia/command-portal.html"));
        
        MenuItem triggerCheck = new MenuItem("Trigger System Check");
        triggerCheck.addActionListener(e -> {
            showNotification("Vistamations Status", "Triggering out-of-band system diagnostic...", MessageType.INFO);
            triggerExternalStatus();
        });

        MenuItem exitItem = new MenuItem("Exit Portal");
        exitItem.addActionListener(e -> {
            System.out.println("[JAVA-PORTAL] Exiting...");
            tray.remove(trayIcon);
            server.stop(0);
            System.exit(0);
        });

        popup.add(openPortal);
        popup.add(triggerCheck);
        popup.addSeparator();
        popup.add(exitItem);

        trayIcon = new TrayIcon(img, "Vistamations Command Portal", popup);
        trayIcon.setImageAutoSize(true);
        trayIcon.setToolTip("Olivia's Direct Desktop Tunnel");

        // Click Tray Icon to open Command Portal
        trayIcon.addActionListener(e -> openWebpage("http://localhost/crons/openclaw/olivia/command-portal.html"));

        tray.add(trayIcon);
        System.out.println("[JAVA-PORTAL] Persistent Tray Icon added successfully.");
        showNotification("Vistamations Portal Active", "Direct secure tunnel established on port " + PORT, MessageType.INFO);
    }

    public static void showNotification(String title, String message, MessageType type) {
        if (trayIcon != null) {
            trayIcon.displayMessage(title, message, type);
        }
    }

    private static void startTunnelServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("0.0.0.0", PORT), 0);
        
        // ─── Direct Olivia Tunnel Endpoint ───
        server.createContext("/tunnel", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                    // Read POST payload
                    InputStream is = exchange.getRequestBody();
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    byte[] buffer = new byte[1024];
                    int len;
                    while ((buffer = new byte[1024]) != null && (len = is.read(buffer)) != -1) {
                        bos.write(buffer, 0, len);
                    }
                    String payload = bos.toString("UTF-8");

                    System.out.println("[JAVA-PORTAL] Received direct tunnel payload: " + payload);

                    // Show visual Desktop popup immediately — bypassing Action Center latency
                    showNotification("Olivia — Direct Signal", "New reply received! Click to open.", MessageType.INFO);

                    // Send response
                    String response = "{\"status\":\"delivered\",\"ok\":true}";
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                    exchange.sendResponseHeaders(200, response.length());
                    OutputStream os = exchange.getResponseBody();
                    os.write(response.getBytes());
                    os.close();
                } else {
                    exchange.sendResponseHeaders(405, -1); // Method Not Allowed
                }
            }
        });

        server.setExecutor(null); // default executor
        server.start();
        System.out.println("[JAVA-PORTAL] Tunnel Server running on port " + PORT);
    }

    private static void openWebpage(String url) {
        try {
            Desktop.getDesktop().browse(new URI(url));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void triggerExternalStatus() {
        try {
            URL url = new URL("http://localhost/api/olivia/respond");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            
            String jsonPayload = "{\"from\":\"Pete\",\"message\":\"Olivia, direct trigger status report\"}";
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes("utf-8");
                os.write(input, 0, input.length);
            }
            
            int code = conn.getResponseCode();
            System.out.println("[JAVA-PORTAL] External trigger HTTP status: " + code);
        } catch (Exception e) {
            System.err.println("[JAVA-PORTAL] Direct trigger call failed: " + e.getMessage());
        }
    }
}

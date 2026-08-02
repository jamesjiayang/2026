package com.example.camelmq;

import org.apache.activemq.broker.BrokerService;

public class BrokerApp {
    public static void main(String[] args) {
        BrokerService broker = new BrokerService();
        try {
            broker.addConnector("tcp://localhost:61616");
            broker.setPersistent(false); // keep in-memory for the demo
            broker.setUseJmx(true);
            
            System.out.println("==================================================");
            System.out.println("Starting embedded ActiveMQ broker...");
            System.out.println("Connector URL: tcp://localhost:61616");
            System.out.println("==================================================");
            
            broker.start();
            
            System.out.println("\nActiveMQ Broker is running!");
            System.out.println("Press Ctrl+C or terminate the process to exit.");
            
            // Keep main thread alive
            Thread.currentThread().join();
            
        } catch (Exception e) {
            System.err.println("Failed to start ActiveMQ broker: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try {
                broker.stop();
            } catch (Exception e) {
                // Ignore
            }
        }
    }
}

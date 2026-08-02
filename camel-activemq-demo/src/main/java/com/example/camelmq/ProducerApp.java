package com.example.camelmq;

import org.apache.activemq.ActiveMQConnectionFactory;
import org.apache.camel.CamelContext;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.component.jms.JmsComponent;
import org.apache.camel.impl.DefaultCamelContext;

public class ProducerApp {
    public static void main(String[] args) {
        System.out.println("==================================================");
        System.out.println("Starting Camel Producer Application...");
        System.out.println("Connecting to ActiveMQ: tcp://localhost:61616");
        System.out.println("==================================================");

        try (CamelContext context = new DefaultCamelContext()) {
            // Setup Connection Factory
            ActiveMQConnectionFactory connectionFactory = new ActiveMQConnectionFactory("tcp://localhost:61616");
            
            // Setup JMS Component
            JmsComponent jmsComponent = JmsComponent.jmsComponentAutoAcknowledge(connectionFactory);
            context.addComponent("activemq", jmsComponent);

            // Add routes to context
            context.addRoutes(new RouteBuilder() {
                @Override
                public void configure() {
                    // Generate a message every 2 seconds
                    from("timer:messageTimer?period=2000")
                        .setBody(simple("Hello ActiveMQ from Camel! Message ID: ${header.CamelTimerCounter} (Timestamp: ${date:now:yyyy-MM-dd HH:mm:ss})"))
                        .log("Producer app sending: ${body}")
                        .to("activemq:queue:camel-activemq-queue");
                }
            });

            // Start Camel context
            context.start();

            System.out.println("\nCamel context started. Sending messages every 2 seconds...");
            System.out.println("Press Ctrl+C or terminate the process to exit.");

            // Let it run indefinitely until terminated
            Thread.currentThread().join();

        } catch (Exception e) {
            System.err.println("Error in Producer Application: " + e.getMessage());
            e.printStackTrace();
        }
    }
}

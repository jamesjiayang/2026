# Apache Camel & ActiveMQ Classic 6.x Demo

This project demonstrates the basic function of Apache Camel connecting two Java applications using ActiveMQ Classic as the message broker.

## Architecture

The project consists of three main Java applications:
1. **BrokerApp**: Programmatically starts an embedded ActiveMQ Classic broker listening on `tcp://localhost:61616`.
2. **ProducerApp**: Periodically (every 2 seconds) generates messages and publishes them to `camel-activemq-queue` using Apache Camel's JMS component.
3. **ConsumerApp**: Listens to the `camel-activemq-queue` and prints incoming messages to the console using Apache Camel's JMS component.

## Prerequisites

- **Java 17** or higher
- **Maven 3.6+**

## How to Run

To run the demo, you will need three separate terminal windows/shells.

### Step 1: Start the ActiveMQ Broker

In the first terminal, navigate to the `camel-activemq-demo` directory and run:

```powershell
mvn exec:java -Dexec.mainClass="com.example.camelmq.BrokerApp"
```

You should see output indicating that the broker is running and accepting TCP connections.

### Step 2: Start the Consumer

In a second terminal, navigate to the `camel-activemq-demo` directory and run:

```powershell
mvn exec:java -Dexec.mainClass="com.example.camelmq.ConsumerApp"
```

You should see the consumer application start and wait for messages on the queue.

### Step 3: Start the Producer

In a third terminal, navigate to the `camel-activemq-demo` directory and run:

```powershell
mvn exec:java -Dexec.mainClass="com.example.camelmq.ProducerApp"
```

You should see the producer application start generating messages:
```text
Producer app sending: Hello ActiveMQ from Camel! Message ID: 1...
Producer app sending: Hello ActiveMQ from Camel! Message ID: 2...
```

Switch back to the second terminal (Consumer) to see the incoming messages logged in real-time:
```text
Consumer app received: Hello ActiveMQ from Camel! Message ID: 1...
Consumer app received: Hello ActiveMQ from Camel! Message ID: 2...
```

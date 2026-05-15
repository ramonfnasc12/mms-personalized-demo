# MMS-Demo

I'm Ramon Nascimento, a solutions architect working for MongoDB in Europe. I usually support customers in the DACH region, being their technical resource in regards of MongoDB, distributed architectures. There are two fronts in my work, I might work together with a sales representative and discover new projects where Mongo can help, deep diving in their architecture, business problems, so I can provide the best solution using MongoDB in the background. Another part of the work is talking to customers already using our solution and validating how to use it better, with the best practices, which might lead to some optimizations and cost reductions.

## 1. Context of the Demo

I'll present in a few months a demo to demonstrate how to implement a solution using MongoDB for the following speach: 

### [cite_start]Presentation Summary: From Personalization to Contextualization [cite: 2, 3]
[cite_start]**Event:** MediaMarktSaturn Tech Summit (18 June 2026) [cite: 8, 9]
[cite_start]**Presenter:** Ronan Conlon, Retail Principal EMEA, MongoDB Industry Solutions Team [cite: 5, 6, 7]

---

1. Core Vision: Personalization vs. Contextualization
[cite_start]The presentation advocates for a shift from traditional personalization to real-time contextualization[cite: 2, 3].
* [cite_start]**Personalization**: Focuses on **who the customer is**[cite: 11]. [cite_start]An example is knowing a person bought a TV last week and upselling them a sound bar[cite: 26].
* [cite_start]**Contextualization**: Focuses on **where the customer is**, what is happening in their area, and their **intention right now**[cite: 13].
* [cite_start]**The Goal**: Move toward "Moments over merchandise" [cite: 22] [cite_start]where contextualization acts as a primary differentiator[cite: 24].

2. Retail Industry Trends (Deloitte 2026 Outlook)
* [cite_start]**94%** of retailers plan to bring more marketing activities in-house[cite: 15, 16].
* [cite_start]**67%** plan to deliver personalization capabilities at scale[cite: 17, 18].
* [cite_start]**44%** believe legacy systems are currently slowing down innovation[cite: 19, 20].

3. The Data Architecture of "Right Now"
[cite_start]To deliver a "right now" experience, data cannot be updated periodically through batch processes[cite: 52, 53].
* [cite_start]**Objective**: Process a geographic trigger against external and internal data points to create a product offer in **milliseconds**[cite: 56].
* [cite_start]**Real-Time Event Layer**: Converts context and customer interactions into real-time signals via event creation, streaming, and routing[cite: 57, 61, 62, 66].
* [cite_start]**Operational Data Layer (ODL)**: Breaks down silos (CRM, Transactions, Legacy Databases) into a "Unified Data Model" or "Customer 360"[cite: 80, 87, 88].
* [cite_start]**Context 360**: Logically centralizes data to simplify implementation and create a consistent version of the truth[cite: 77, 78].

4. Handling Multi-Modal and Unstructured Data
[cite_start]Contextual data is "messy" and requires engineers to process various forms[cite: 98, 99]:
* [cite_start]**Input Types**: Geospatial signals, unstructured conversational data, text, images, video, and structured third-party API responses[cite: 99, 103, 106, 107, 109].
* [cite_start]**Processing Pipeline**: Data undergoes cleaning, transforming, and feature extraction to generate **Vector Embeddings**[cite: 111, 113, 115].
* [cite_start]**Vector Store**: Powers AI models, semantic search, and advanced recommendations[cite: 110, 112, 114, 117].

5. Security as a Precondition
[cite_start]Security must be a "first-class citizen" rather than an afterthought[cite: 118, 135].
* [cite_start]**Customer Sentiment**: 52% of shoppers will switch retailers for better data protection policies[cite: 121].
* [cite_start]**Requirement**: Guardrails must be visible and protect data at rest, in transit, and during processing[cite: 122, 124].

---

6. Summary of Key Takeaways
1.  [cite_start]**Real-Time, Event-Driven**: Process live location against external contexts[cite: 128, 129, 130].
2.  [cite_start]**Single Source of Truth**: Use an ODL to speed up decision-making[cite: 131, 132].
3.  [cite_start]**Multi-Modal Support**: Handle data in many forms, especially from external sources[cite: 133, 134].
4.  [cite_start]**Security First**: Ensure data is secure throughout its entire lifecycle[cite: 135, 136].

## 2.Demo Structure

The main idea of the demo is to showcase how information like customer geo position, near local and global events, weather forecast can serve as input for a product recommendation tool.

The demo will be interactive with the customer. I want to create a public web page so the customer can access it and be able to simulate their position, event and weather information + previous purchases, products viewed and carts. This information will be synched with a backend system that will work to process the data and present the product recommendation to the customer.

## 3. Requirements

### Intake Flow

- Frontend created in React with Typescript
- Use the link ```https://www.mediamarkt.de/``` as a base for the frontend page, mainly considering the color schema
- Frontend should be very simple, showing the following information for the customer to interact:
- Create a few options for Weather, Events and Position as a dropdown, so the customer can choose whatever they like

- The data will be sent to backend API endpoint, that needs to store data in two MongoDB collections

Collection A:
-- Lat/Long as GeoJson
-- timestamp
-- CustomerID

CollectionB:
-- CustomerID
-- Customer Activity
-- Weather
-- Event
-- timestamp

### Processing Flow

- A backend process will subscribe to updates on the position collection (A) using MongoDB change stream, validating if the customer is within 1km from a store. This query needs to use MongoDB geoposition queries.

- A 2dsphere index needs to be created in the store collections for the store positions

- If a customer is near a store, send this information to a queue with the customerId and storeId.

- A worker will process this information, doing the following:
-- Get Latest Customer Activities (Simulation, as that is provided from customer's input)
-- Get Weather Data (Simulation, as that is provided from customer's input)
-- Get external events (Simulation, as that is provided from customer's)
-- Data above needs to be retrieve by querying the collection B with the customerId in the demo
-- Use LLM to create context for product vector search based on weather, previous activities and events
-- Run a vector search query to get the product the has most to do with the context and locality
-- Use LLM to create custom message to customer
-- Send product and message to a queue
-- When message is ready, send it to a queue
-- A worker will consuming this queue and needs to send a notification to the customer's frontend with the product recommendation and custom message

- Use Langchain for the LLM communication

- Implement the backend using node.js with typescript

## MongoDB Collections

- customerPosition

- customerContext

- stores -> needs to be populated with fake data
Fields:
-- storeId
-- position
-- name

- products -> needs to be populated with fake data
Fields:
-- productId
-- name
-- price
-- description
-- inventory (array - for each storeId has the quantity available)

## Final

I need you to make a comprehensive plan (and write it down as PLAN.md) before coding anything, and make sure you ask me if I left anything unexplained or ambiguous.

Remember this is a demo project and doesn't need to go to production. This means that there's no need to use complex third party systems. The stack should be bounded to:

- MongoDB as a Database
- NodeJS for backend. Queues should be created in memory
- ReactJS for frontend

- Use MongoDB Skills available as much as possible to make a good use of the MongoDB resources.

- When it comes to interact with the Database, you should use MongoDB MCP Server, connecting to the cluster Cluster0
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: path.resolve(__dirname, 'credentials/.env') });

const app = express();
const portNumber = process.argv[2] || 3000;

// MongoDB configuration
const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.rhshd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const databaseAndCollection = {
  db: process.env.MONGO_DB_NAME,
  collection: process.env.MONGO_DB_COLLECTION,
};

// Middleware
app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.render('form');
});

app.post('/find-email', async (req, res) => {
  const { name, company } = req.body;

  try {
    // Call Findymail API using fetch
    const response = await fetch('https://app.findymail.com/api/search/name', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FINDYMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        domain: company,
      }),
    });

    const data = await response.json();
    console.log(data);
    const email = data.contact.email || 'Not Found';

    // Store result in MongoDB
    await client.connect();
    const collection = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection);
    await collection.insertOne({ "Name": name, "Company Website": company, "Email": data.contact.email});

    res.render('results', { name, company, email });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error finding email. Please try again later.');
  } finally {
    await client.close();
  }
});

app.get('/download-emails', async (req, res) => {
  try {
    await client.connect();
    const collection = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection);
    const emails = await collection.find({}).toArray();
    console.log(emails);
    const csvContent = emails.map(e => `${e.Name},${e['Company Website']},${e.Email}`).join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('emails.csv');
    res.send(csvContent);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error downloading emails.');
  } finally {
    await client.close();
  }
});

// Start server
app.listen(portNumber, () => {
  console.log(`Server running at http://localhost:${portNumber}`);
});

// Handle shutdown
process.stdin.setEncoding('utf8');
process.stdout.write('Type stop to shutdown the server: ');
process.stdin.on('readable', () => {
  let input = process.stdin.read();
  if (input !== null) {
    let command = input.trim();
    if (command === 'stop') {
      console.log('Shutting down the server.');
      process.exit(0);
    }
    process.stdout.write('Type stop to shutdown the server: ');
  }
});

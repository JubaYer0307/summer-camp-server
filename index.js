const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }

  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ec8hxwt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    

    const usersCollection = client.db('PhotoMe').collection('users');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.json({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    };

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'User already exists' });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
    
      try {
        const user = await usersCollection.findOne(query);
    
        if (!user) {
          return res.status(404).send({ error: true, message: 'User not found' });
        }
    
        res.send({ role: user.role }); // Send the role property instead of admin property
      } catch (error) {
        console.error('Error while checking role:', error);
        res.status(500).send({ error: true, message: 'Internal server error' });
      }
    });
    

    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      try {
        const query = { _id: new ObjectId(id) };
        const update = { $set: updatedData };
        const result = await usersCollection.updateOne(query, update);

        if (result.modifiedCount === 1) {
          res.json({ success: true, modifiedCount: result.modifiedCount });
        } else {
          res.status(404).json({ success: false, error: 'User not found' });
        }
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    app.get('/classes/:id', async (req, res) => {
      const { id } = req.params;
    
      try {
        const query = { _id: new ObjectId(id) };
        const classObj = await classCollection.findOne(query);
    
        if (!classObj) {
          return res.status(404).json({ success: false, error: 'Class not found' });
        }
    
        res.json({ success: true, class: classObj });
      } catch (error) {
        console.error('Error retrieving class:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });
    
    app.patch('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
    
      try {
        const query = { _id: new ObjectId(id) };
        const update = { $set: updatedData };
        const updatedClass = await classCollection.findOneAndUpdate(query, update, { returnOriginal: false });
    
        if (!updatedClass) {
          return res.status(404).json({ success: false, error: 'Class not found' });
        }
    
        res.json({ success: true, updatedClass });
      } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });
    
    

    const instructorCollection = client.db('PhotoMe').collection('instructors');

    app.get('/instructors', async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });

    const classCollection = client.db('PhotoMe').collection('classes');

    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.post('/classes', async (req, res) => {
      const newItem = req.body;

      try {
        const result = await classCollection.insertOne(newItem);
        if (result.insertedCount > 0) {
          const insertedClass = result.ops[0];
          res.status(201).send(insertedClass);
        } else {
          res.status(500).send({ error: 'Failed to save the class' });
        }
      } catch (error) {
        console.error('Error saving class:', error);
        res.status(500).send({ error: 'An error occurred while saving the class' });
      }
    });


    app.patch('/classes/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        const updatedClass = await classCollection.findOneAndUpdate(
          { _id: ObjectId(id) },
          { $set: { status: status } },
          { returnOriginal: false }
        );
    
        if (!updatedClass) {
          return res.status(404).json({ success: false, error: 'Class not found' });
        }
    
        res.json({ success: true, updatedClass });
      } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });
    
    



    const selectedClassCollection = client.db('PhotoMe').collection('selectedClass');

    app.get('/selectedClass', verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' });
      }

      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/selectedClass', async (req, res) => {
      const item = req.body;
      const result = await selectedClassCollection.insertOne(item);
      res.send(result);
    });

    app.delete('/selectedClass/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    const paymentCollection = client.db('PhotoMe').collection('payments');

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).send({ error: 'An error occurred while creating the payment intent' });
      }
    });

    app.post('/save-payment', async (req, res) => {
      const payment = req.body;
    
      try {
        const result = await paymentCollection.insertOne(payment);
        res.send(result);
      } catch (error) {
        console.error('Error saving payment:', error);
        res.status(500).send({ error: 'An error occurred while saving the payment' });
      }
    });

    app.get('/save-payment', verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const query = { email: email };
    
      try {
        const payments = await paymentCollection.find(query).toArray();
        res.send(payments);
      } catch (error) {
        console.error('Error retrieving payments:', error);
        res.status(500).send({ error: 'An error occurred while retrieving the payments' });
      }
    });
    
    

    

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8tifwil.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    console.log(decoded);
    next();
  });
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const lessonsCollection = client.db("vocabularyApp").collection("lessons");
    const vocabularyCollection = client
      .db("vocabularyApp")
      .collection("vocalbulary");
    const usersCollection = client.db("vocabularyApp").collection("users");
    const tutorailsCollection = client
      .db("vocabularyApp")
      .collection("tutorials");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyUser = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user.role !== "user") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "5d",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.get("/lessons", verifyJWT, verifyUser, async (req, res) => {
      const cursor = lessonsCollection.find().sort({ lessonNumber: 1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/vocabulary/:lessonNumber", async (req, res) => {
      const lessonNumber = parseInt(req.params.lessonNumber, 10);
      const query = { lessonNumber };
      const vocabulary = await vocabularyCollection.find(query).toArray();
      res.send(vocabulary);
    });

    app.get("/tutorials", verifyJWT, verifyUser, async (req, res) => {
      const cursor = tutorailsCollection.find().sort({ title: 1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.get("/allUsers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/allVocabulary", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const vocabulary = await vocabularyCollection
        .find(query)
        .sort({ lessonNumber: 1 })
        .toArray();
      res.send(vocabulary);
    });

    app.get("/word/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await vocabularyCollection.findOne(query);
      res.send(result);
      console.log(id);
    });

    app.get("/allLessons", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const lessons = await lessonsCollection
        .find(query)
        .sort({ lessonNumber: 1 })
        .toArray();
      res.send(lessons);
    });

    app.get("/lesson/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await lessonsCollection.findOne(query);
      res.send(result);
      console.log(id);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.post("/lesson", verifyJWT, verifyAdmin, async (req, res) => {
      const lesson = req.body;
      const result = await lessonsCollection.insertOne(lesson);
      res.send(result);
    });

    app.post("/vocabulary", verifyJWT, verifyAdmin, async (req, res) => {
      const vocabulary = req.body;
      const result = await vocabularyCollection.insertOne(vocabulary);
      const lessonNumber = vocabulary.lessonNumber;
      const updateResult = await lessonsCollection.updateOne(
        { lessonNumber }, // Filter by lessonNumber
        { $inc: { wordCount: 1 } } // Increment wordCount by 1
      );
      res.send(result);
    });

    app.patch(
      "/users/makeAdmin/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.patch(
      "/users/makeUser/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "user",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.put("/updatevocab/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        word: req.body.word,
        pronunciation: req.body.pronunciation,
        meaning: req.body.meaning,
        whenToSay: req.body.whenToSay,
        lessonNumber: req.body.lessonNumber,
      };
      const result = await vocabularyCollection.replaceOne(filter, updatedDoc);
      res.send(result);
      console.log(result);
    });

    app.put("/updatelesson/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        lessonNumber: req.body.lessonNumber,
        lessonName: req.body.lessonName,
        wordCount: req.body.wordCount,
      };
      const result = await lessonsCollection.replaceOne(filter, updatedDoc);
      res.send(result);
      console.log(result);
    });

    app.delete(
      "/delete-my-users/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);
        res.send(result);
        console.log(result);
      }
    );

    app.delete(
      "/delete-vocabulary/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await vocabularyCollection.deleteOne(query);
        res.send(result);
        console.log(result);
      }
    );

    app.delete(
      "/delete-lesson/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await lessonsCollection.deleteOne(query);
        res.send(result);
        console.log(result);
      }
    );

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("vocabulary app server is running");
});

app.listen(port, () => {
  console.log(`i am running on port ${port}`);
});

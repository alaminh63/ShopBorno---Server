require("dotenv").config();
const express = require("express");
const port = process.env.PORT || 3000;
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());
// verify jwt token
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.SECKRET_KEY, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// mongodb server connect
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.SECRET_PASSWORD}@cluster0.pdzlhd7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    //  client.connect();

    const usersCollection = client.db("shopBorno").collection("users");
    const productsCollection = client.db("shopBorno").collection("products");
    const cartProductsCollection = client
      .db("shopBorno")
      .collection("cartProducts");

    // jwt section
    app.post("/jwt", (req, res) => {
      const email = req.query.email;
      const token = jwt.sign(
        {
          email: email,
        },
        process.env.SECKRET_KEY,
        { expiresIn: "20000h" }
      );
      res.send({ token });
    });

    // checking authorization
    app.get("/authorization", async (req, res) => {
      const email = req?.query?.email;
      const user = await usersCollection.findOne({ email: email });
      if (user) {
        res.send({ role: user?.role });
      }
    });

    // users requests section here

    app.put("/add-user", async (req, res) => {
      const userData = req.body;
      const email = req?.query?.email;
      const filter = {
        email: email,
      };

      const savedUser = await usersCollection.findOne(filter);
      const user = {
        $set: {
          name: userData?.name,
          email: userData?.email,
          photo_url: userData?.photo_url,
          phone: userData?.phone,
          role: savedUser?.role || "admin",
        },
      };
      const options = { upsert: true };
      const result = await usersCollection.updateOne(filter, user, options);
      res.send(result);
    });

    // instructors requests section

    // admin page req section here
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.delete("/delete-user/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // get all the products
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });
    app.delete("/delete-product/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // get single products
    app.get("/products/:category", async (req, res) => {
      const category = req.params.category.toLowerCase();
      const query = { category: category };
      try {
        const result = await productsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: true, message: "Internal Server Error" });
      }
    });
    app.get("/subProducts/:subCategory", async (req, res) => {
      const subCategory = req.params.subCategory.toLowerCase();
      const query = { subCategory: subCategory };
      try {
        const result = await productsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: true, message: "Internal Server Error" });
      }
    });

    // get all products
    app.get("/singleProduct/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await productsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: true, message: "Internal Server Error" });
      }
    });

    // adding product in cart
    app.post("/cartProducts", async (req, res) => {
      try {
        const cartProduct = req.body;
        const query = {
          productId: cartProduct.productId,
          email: cartProduct.email,
          price: cartProduct.price,
        };
        const existingProduct = await cartProductsCollection.findOne(query);
        if (existingProduct) {
          return res.send({ message: "Product already added to cart" });
        }
        const result = await cartProductsCollection.insertOne(cartProduct);
        res.send({ insertedId: result.insertedId });
      } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    app.get("/cartProducts", async (req, res) => {
      const result = await cartProductsCollection.find().toArray();
      res.send(result);
    });
    app.get("/cartProducts/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await cartProductsCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/cartProducts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartProductsCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/post-product", async (req, res) => {
      try {
        const data = req.body;
        const newProduct = {
          title: data.title,
          category: data.category,
          subCategory: data.subCategory,
          image: data.image,
          color: data.color,
          description: data.description,
          rating: parseFloat(data.rating),
          price: parseFloat(data.price),
        };

        const result = await productsCollection.insertOne(newProduct);
        res.status(200).json({ insertedId: result.insertedId });
      } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  } catch (error) {
    console.log(error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running well");
});

app.listen(port, () => {
  console.log(`simple crud is running in port :${port}`);
});

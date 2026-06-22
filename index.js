const express = require("express");
const app = express();
const cors = require("cors");
objectId = require("mongodb").ObjectId;
const { MongoClient, ServerApiVersion } = require("mongodb");
const { jwtVerify } = require("jose-cjs");
require("dotenv").config();
const port = process.env.PORT;
app.use(express.json());
app.use(cors());
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// const verifyToken = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }
//   const token = authHeader.split(" ")[1];
//   try {
//     const secret = new TextEncoder().encode(process.env.JWT_SECRET);
//     const { payload } = await jwtVerify(token, secret);
//     req.session = { user: payload };
//     next();
//   } catch {
//     return res.status(401).json({ message: "Invalid token" });
//   }
// };

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const database = client.db("test");
    const productCollection = database.collection("products");

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    app.get("/api/products", async (req, res) => {
      const products = await productCollection.find({}).toArray();
      console.log(process.env.NEXT_URL);
      res.json(products);
    });
    app.get("/api/products/:id", async (req, res) => {
      const id = req.params.id;
      const product = await productCollection.findOne({
        _id: new objectId(id),
      });
      res.json(product);
    });

    app.patch("/api/updateproduct/:id", async (req, res) => {
      const id = req.params.id;
      const {
        title,
        description,
        category,
        condition,
        price,
        stock,
        phone,
        images,
      } = req.body;
      console.log("HIT updateproduct, id:", req.params.id, "body:", req.body);
      const updateFields = {};
      if (title !== undefined) updateFields.title = title;
      if (description !== undefined) updateFields.description = description;
      if (category !== undefined) updateFields.category = category;
      if (condition !== undefined) updateFields.condition = condition;
      if (price !== undefined) updateFields.price = Number(price);
      if (stock !== undefined) updateFields.stock = Number(stock);
      if (phone !== undefined) updateFields.phone = phone;
      if (images !== undefined) updateFields.images = images;
      updateFields.updatedAt = new Date();

      const result = await productCollection.findOneAndUpdate(
        { _id: new objectId(id) },
        { $set: updateFields },
        { returnDocument: "after" },
      );

      if (!result) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(result);
    });

    const wishlistCollection = database.collection("wishlists");

    app.get("/api/getwishlist", async (req, res) => {
      try {
        const { email } = req.query;
        const wishlist = await wishlistCollection
          .find({ userEmail: email })
          .toArray();
        res.json(
          wishlist.map((item) => ({ ...item, _id: item._id.toString() })),
        );
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.post("/api/addtowishlist", async (req, res) => {
      try {
        const { userEmail, ...data } = req.body;
        const existing = await wishlistCollection.findOne({
          userEmail,
          productId: data.productId,
        });
        if (existing) {
          return res
            .status(409)
            .json({ ...existing, _id: existing._id.toString() });
        }
        const result = await wishlistCollection.insertOne({
          ...data,
          userEmail,
          addedAt: new Date(),
        });
        res
          .status(201)
          .json({ _id: result.insertedId.toString(), ...data, userEmail });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.delete("/api/deletewishlist/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await wishlistCollection.deleteOne({
          _id: new objectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Wishlist item not found" });
        }
        res.json({ message: "Removed from wishlist" });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.delete("/api/deleteproduct/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({
        _id: new objectId(id),
      });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    });

    app.post("/api/createproduct", async (req, res) => {
      const {
        title,
        description,
        category,
        condition,
        price,
        stock,
        phone,
        images,
      } = req.body;
      const { user } = req.body;

      const product = {
        title,
        description,
        category,
        condition,
        price: Number(price),
        stock: Number(stock),
        phone,
        images,
        sellerInfo: {
          userId: user._id,
          name: user.name,
          email: user.email,
          phone: phone || user.phone,
        },
        status: "pending",
        reported: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await productCollection.insertOne(product);
      res.status(201).json({ insertedId: result.insertedId, ...product });
    });

    const orderCollection = database.collection("orders");
    const paymentCollection = database.collection("payments");

    app.post("/api/createorders", async (req, res) => {
      try {
        const { buyerInfo, items } = req.body;
        const orders = items.map((item) => ({
          productId: item.productId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          buyerInfo,
          sellerInfo: item.sellerInfo,
          orderStatus: "Processing",
          paymentStatus: "pending",
          createdAt: new Date(),
        }));
        const result = await orderCollection.insertMany(orders);
        const orderIds = Object.values(result.insertedIds).map((id) =>
          id.toString(),
        );
        res.status(201).json({ orderIds });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.post("/api/createpayment", async (req, res) => {
      try {
        const { orderIds, transactionId, amount, paymentStatus } = req.body;
        const objectIds = orderIds.map((id) => new objectId(id));

        const payments = orderIds.map((orderId) => ({
          orderId,
          transactionId,
          amount,
          paymentStatus,
          createdAt: new Date(),
        }));
        await paymentCollection.insertMany(payments);

        await orderCollection.updateMany(
          { _id: { $in: objectIds } },
          { $set: { paymentStatus, updatedAt: new Date() } },
        );

        res.status(201).json({ success: true });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.get("/api/getorders", async (req, res) => {
      try {
        const { email, role } = req.query;
        const query = {};
        if (email && role === "seller") query["sellerInfo.email"] = email;
        else if (email) query["buyerInfo.email"] = email;
        const orders = await orderCollection.find(query).toArray();
        res.json(orders.map((o) => ({ ...o, _id: o._id.toString() })));
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.patch("/api/updateorder/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await orderCollection.findOneAndUpdate(
          { _id: new objectId(id) },
          { $set: { ...req.body, updatedAt: new Date() } },
          { returnDocument: "after" },
        );
        if (!result) return res.status(404).json({ message: "Order not found" });
        res.json({ ...result, _id: result._id.toString() });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.get("/api/getpayments", async (req, res) => {
      try {
        const { email } = req.query;
        const orders = await orderCollection
          .find({ "buyerInfo.email": email }, { projection: { _id: 1 } })
          .toArray();
        const orderIds = orders.map((o) => o._id.toString());
        const payments = await paymentCollection
          .find({ orderId: { $in: orderIds } })
          .toArray();
        res.json(payments.map((p) => ({ ...p, _id: p._id.toString() })));
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

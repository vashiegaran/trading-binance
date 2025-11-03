import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { logger } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

async function clearDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "trading_bot";

  if (!mongoUri) {
    logger.error("❌ MONGODB_URI not found in environment variables");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    logger.info("🔌 Connecting to MongoDB...");
    await client.connect();
    logger.info("✅ Connected to MongoDB");

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      logger.info("ℹ️  Database is already empty");
      await client.close();
      return;
    }

    logger.info(`🗑️  Found ${collections.length} collection(s) to delete:`);
    collections.forEach((col) => logger.info(`   - ${col.name}`));

    // Delete all collections
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({});
      logger.info(`   ✅ Cleared: ${collection.name}`);
    }

    logger.info("🎉 Database cleared successfully!");
  } catch (error: any) {
    logger.error(`❌ Error clearing database: ${error.message}`);
    process.exit(1);
  } finally {
    await client.close();
    logger.info("👋 MongoDB connection closed");
  }
}

// Run the script
clearDatabase().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});


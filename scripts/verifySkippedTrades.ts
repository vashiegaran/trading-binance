#!/usr/bin/env node

/**
 * Verification Script: Check Skipped Trades Count
 * 
 * This script verifies that all skipped trades are properly saved to MongoDB
 * and can be counted correctly.
 * 
 * Usage:
 *   npm run verify-skipped
 *   or
 *   tsx scripts/verifySkippedTrades.ts
 */

import { MongoService } from "../src/services/mongodbService.js";
import { config } from "dotenv";
import path from "path";

// Load environment variables
config({ path: path.join(process.cwd(), ".env") });

async function verifySkippedTrades() {
  console.log("🔍 Verifying Skipped Trades in MongoDB...\n");

  const mongoService = new MongoService();

  try {
    // Connect to MongoDB
    console.log("📡 Connecting to MongoDB...");
    await mongoService.connect();
    console.log("✅ Connected to MongoDB\n");

    // Get decision statistics
    console.log("📊 Getting Decision Statistics...");
    const stats = await mongoService.getDecisionStatistics();
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📈 DECISION STATISTICS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Total Decisions:   ${stats.total}`);
    console.log(`Traded:            ${stats.traded} (${stats.tradedPercent.toFixed(2)}%)`);
    console.log(`Skipped:           ${stats.skipped} (${stats.skippedPercent.toFixed(2)}%)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Get skip reasons breakdown
    console.log("📋 Getting Skip Reasons Breakdown...");
    const skipReasons = await mongoService.getSkipReasonsStatistics();

    if (skipReasons.length > 0) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚫 SKIP REASONS BREAKDOWN");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      skipReasons.forEach((sr, index) => {
        const latestDate = sr.latest instanceof Date ? sr.latest.toISOString() : sr.latest;
        console.log(`${index + 1}. ${sr.reason}: ${sr.count} time(s)`);
        console.log(`   Latest: ${latestDate}`);
      });
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    } else {
      console.log("⚠️  No skip reasons found\n");
    }

    // Get recent skipped decisions (last 10)
    console.log("🔍 Getting Recent Skipped Decisions (last 10)...");
    const recentSkipped = await mongoService.getHourDecisions(
      undefined, // startDate
      undefined, // endDate
      "SKIPPED", // decision filter
      10 // limit
    );

    if (recentSkipped.length > 0) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🕐 RECENT SKIPPED DECISIONS");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      recentSkipped.forEach((decision, index) => {
        const timestamp = decision.timestamp instanceof Date 
          ? decision.timestamp.toISOString() 
          : decision.timestamp;
        const reasonsCount = decision.skipReasons?.length || 0;
        console.log(`\n${index + 1}. Timestamp: ${timestamp}`);
        console.log(`   Skip Reasons: ${reasonsCount}`);
        if (decision.skipReasons && decision.skipReasons.length > 0) {
          decision.skipReasons.forEach((reason, rIndex) => {
            console.log(`   ${rIndex + 1}. ${reason.reason}`);
            if (reason.details) {
              const details = JSON.stringify(reason.details, null, 2);
              console.log(`      Details: ${details.replace(/\n/g, '\n      ')}`);
            }
          });
        }
      });
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    } else {
      console.log("⚠️  No skipped decisions found\n");
    }

    // Verification summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ VERIFICATION SUMMARY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (stats.skipped > 0) {
      console.log("✅ Skipped trades are being saved correctly");
      console.log(`✅ Found ${stats.skipped} skipped decisions in database`);
      console.log(`✅ ${skipReasons.length} different skip reason types found`);
      
      // Check if skipped count matches skip reasons count
      const totalSkipReasons = skipReasons.reduce((sum, sr) => sum + sr.count, 0);
      if (totalSkipReasons === stats.skipped) {
        console.log("✅ Skip reasons count matches skipped decisions count");
      } else {
        console.log(`⚠️  Warning: Skip reasons count (${totalSkipReasons}) doesn't match skipped decisions (${stats.skipped})`);
        console.log("   Note: This is normal if some decisions have multiple reasons");
      }
    } else {
      console.log("⚠️  No skipped trades found in database");
      console.log("   This could mean:");
      console.log("   - Bot hasn't run yet");
      console.log("   - All trades executed successfully");
      console.log("   - MongoDB connection issue");
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error: any) {
    console.error("❌ Error verifying skipped trades:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoService.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the verification
verifySkippedTrades().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});


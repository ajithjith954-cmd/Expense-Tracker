package com.expensetracker.smscapture

import android.content.Context
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.security.MessageDigest

class SmsQueue(context: Context) : SQLiteOpenHelper(context, "sms-ingestion.db", null, 1) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE queued_sms (
        id TEXT PRIMARY KEY NOT NULL,
        body TEXT NOT NULL,
        fingerprint TEXT NOT NULL UNIQUE,
        received_at TEXT NOT NULL
      )
      """.trimIndent(),
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  fun enqueue(body: String, receivedAt: String) {
    val fingerprint = sha256(body.trim())
    val values = ContentValues().apply {
      put("id", fingerprint.take(16))
      put("body", body)
      put("fingerprint", fingerprint)
      put("received_at", receivedAt)
    }
    writableDatabase.insertWithOnConflict("queued_sms", null, values, SQLiteDatabase.CONFLICT_IGNORE)
  }

  fun drain(): List<Map<String, String>> {
    val rows = mutableListOf<Map<String, String>>()
    readableDatabase.query(
      "queued_sms",
      arrayOf("id", "body", "received_at"),
      null,
      null,
      null,
      null,
      "received_at",
    ).use { cursor ->
      while (cursor.moveToNext()) {
        rows.add(
          mapOf(
            "id" to cursor.getString(0),
            "body" to cursor.getString(1),
            "receivedAt" to cursor.getString(2),
          ),
        )
      }
    }
    return rows
  }

  fun remove(ids: List<String>) {
    val database = writableDatabase
    for (id in ids) {
      database.delete("queued_sms", "id = ?", arrayOf(id))
    }
  }

  fun clear() {
    writableDatabase.delete("queued_sms", null, null)
  }

  private fun sha256(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray())
    return digest.joinToString("") { byte -> "%02x".format(byte) }
  }
}

package com.expensetracker.smscapture

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsCaptureModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsCapture")

    Function("isAvailable") {
      true
    }

    Function("setEnabled") { enabled: Boolean ->
      val context = appContext.reactContext ?: return@Function
      SmsCaptureStore.setEnabled(context, enabled)
    }

    AsyncFunction("drain") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, String>>()
      SmsQueue(context).drain()
    }

    AsyncFunction("remove") { ids: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      SmsQueue(context).remove(ids)
      null
    }

    AsyncFunction("clear") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      SmsQueue(context).clear()
      null
    }
  }
}

package io.github.aoprisan.globalconflict;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Walk Mode's native step source. Two jobs:
 *
 * 1. Live steps: while the app is open, TYPE_STEP_DETECTOR fires a "step"
 *    event per step — hardware-detected, far more accurate and cheaper than
 *    reading the accelerometer from JS.
 * 2. Banked steps: TYPE_STEP_COUNTER is a cumulative hardware counter that
 *    keeps counting while the app is closed (it counts since boot, no service
 *    needed). claimBanked() diffs it against the value stored at the last
 *    claim, so the game can credit steps taken while it wasn't running.
 *
 * The JS side (src/steps/nativePedometerSource.ts) feeds both through the same
 * throttle-capped click path as tapping.
 */
@CapacitorPlugin(
    name = "Pedometer",
    permissions = @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = "activity")
)
public class PedometerPlugin extends Plugin implements SensorEventListener {

    private static final String PREFS = "gc.pedometer";
    private static final String KEY_COUNTER_BASE = "counterBase";
    private static final long CLAIM_TIMEOUT_MS = 3000;

    private SensorManager sensorManager;
    private Sensor stepDetector;
    private Sensor stepCounter;
    private boolean live = false;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepDetector = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
            stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    private boolean hasPermission() {
        // ACTIVITY_RECOGNITION became a runtime permission in Android 10 (API 29).
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            || getPermissionState("activity") == com.getcapacitor.PermissionState.GRANTED;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", stepDetector != null || stepCounter != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (stepDetector == null && stepCounter == null) {
            call.reject("no step sensor on this device");
            return;
        }
        if (!hasPermission()) {
            requestPermissionForAlias("activity", call, "startPermissionCallback");
            return;
        }
        beginLive(call);
    }

    @PermissionCallback
    private void startPermissionCallback(PluginCall call) {
        if (!hasPermission()) {
            call.reject("denied");
            return;
        }
        beginLive(call);
    }

    private void beginLive(PluginCall call) {
        if (!live) {
            if (stepDetector != null) {
                sensorManager.registerListener(this, stepDetector, SensorManager.SENSOR_DELAY_UI);
            }
            // Track the cumulative counter alongside live stepping so live-mined
            // steps advance the banked baseline — no double credit on next claim.
            if (stepCounter != null) {
                sensorManager.registerListener(this, stepCounter, SensorManager.SENSOR_DELAY_UI);
            }
            live = true;
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (live) {
            sensorManager.unregisterListener(this);
            live = false;
        }
        call.resolve();
    }

    @PluginMethod
    public void claimBanked(PluginCall call) {
        if (stepCounter == null) {
            resolveSteps(call, 0);
            return;
        }
        if (!hasPermission()) {
            requestPermissionForAlias("activity", call, "claimPermissionCallback");
            return;
        }
        readCounterOnce(call);
    }

    @PermissionCallback
    private void claimPermissionCallback(PluginCall call) {
        if (!hasPermission()) {
            resolveSteps(call, 0);
            return;
        }
        readCounterOnce(call);
    }

    /** One-shot read of the cumulative counter; diff against the stored base. */
    private void readCounterOnce(PluginCall call) {
        Handler handler = new Handler(Looper.getMainLooper());
        SensorEventListener[] holder = new SensorEventListener[1];
        Runnable timeout = () -> {
            sensorManager.unregisterListener(holder[0]);
            resolveSteps(call, 0); // sensor silent — claim nothing, keep the base
        };
        holder[0] = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                handler.removeCallbacks(timeout);
                sensorManager.unregisterListener(this);
                resolveSteps(call, claimFromCounter(event.values[0]));
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };
        sensorManager.registerListener(holder[0], stepCounter, SensorManager.SENSOR_DELAY_FASTEST);
        handler.postDelayed(timeout, CLAIM_TIMEOUT_MS);
    }

    /** Diff the cumulative since-boot counter against the last claimed value.
     *  First claim just sets the base; a smaller reading means a reboot, in
     *  which case everything since boot is new. */
    private synchronized long claimFromCounter(float current) {
        SharedPreferences p = prefs();
        long banked = 0;
        if (p.contains(KEY_COUNTER_BASE)) {
            float base = p.getFloat(KEY_COUNTER_BASE, 0f);
            banked = (long) (current >= base ? current - base : current);
        }
        p.edit().putFloat(KEY_COUNTER_BASE, current).apply();
        return Math.max(0, banked);
    }

    private void resolveSteps(PluginCall call, long steps) {
        JSObject ret = new JSObject();
        ret.put("steps", steps);
        call.resolve(ret);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            JSObject data = new JSObject();
            data.put("count", (int) Math.max(1, event.values.length > 0 ? event.values[0] : 1));
            notifyListeners("step", data);
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            // live stepping moves the banked baseline forward with the counter
            prefs().edit().putFloat(KEY_COUNTER_BASE, event.values[0]).apply();
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}

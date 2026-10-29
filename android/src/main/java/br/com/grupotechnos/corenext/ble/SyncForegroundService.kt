package br.com.grupotechnos.corenext.ble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.log.WatchLogger

/**
 * Serviço em primeiro plano (`connectedDevice`) que existe só enquanto uma sincronização roda.
 *
 * Por que só no sync: fora dele a conexão vive pelo `BluetoothGatt` com `autoConnect` enquanto o processo existir,
 * e um FGS permanente (como o `TechnosForegroundService` do Core atual, `START_STICKY`) é exatamente o que as
 * regras de FGS do Android 14+ restringem. Durante o sync ele evita que o processo seja congelado no meio da leitura
 * do histórico se a pessoa sair do app.
 *
 * Sem `START_STICKY`: se o sistema matar o processo, o sync morre junto e o app sincroniza de novo na próxima vez.
 *
 * Falhas ao subir (`ForegroundServiceStartNotAllowedException` com o app em segundo plano na API 31+, ou
 * `SecurityException` sem `BLUETOOTH_CONNECT` na API 34+) não interrompem o sync: só ficam no log como `WARN`.
 */
class SyncForegroundService : Service() {
	override fun onBind(intent: Intent?): IBinder? = null

	override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
		// startForeground primeiro, sempre: um startForegroundService sem startForeground em ~5 s derruba o app,
		// mesmo que o sync já tenha acabado e o serviço vá parar logo em seguida.
		val started = try {
			ensureChannel(this)
			val notification = buildNotification(this)
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
				startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
			} else {
				startForeground(NOTIFICATION_ID, notification)
			}
			true
		} catch (error: RuntimeException) {
			logger?.log(LogLevel.WARN, "SyncForegroundService/onStartCommand", "startForeground failed: ${error.javaClass.simpleName}: ${error.message}")
			false
		}
		synchronized(lock) {
			instance = this
			if (!started || !shouldRun) {
				stopSelfNow()
				return START_NOT_STICKY
			}
		}
		logger?.log(LogLevel.INFO, "SyncForegroundService/onStartCommand", "Foreground service running during sync")
		return START_NOT_STICKY
	}

	override fun onDestroy() {
		synchronized(lock) {
			if (instance === this) instance = null
		}
		super.onDestroy()
	}

	private fun stopSelfNow() {
		stopForeground(STOP_FOREGROUND_REMOVE)
		stopSelf()
		if (instance === this) instance = null
	}

	companion object {
		const val CHANNEL_ID = "corenext.sync"
		const val NOTIFICATION_ID = 0x5C01

		/** Logger do processo, injetado pelo `CoreGraph`. */
		@Volatile var logger: WatchLogger? = null

		private val lock = Any()
		private var shouldRun = false
		private var instance: SyncForegroundService? = null

		/** Sobe o serviço. Nunca lança: em caso de recusa do sistema, só loga. */
		fun start(context: Context) {
			synchronized(lock) {
				shouldRun = true
				if (instance != null) return
			}
			try {
				val intent = Intent(context.applicationContext, SyncForegroundService::class.java)
				context.applicationContext.startForegroundService(intent)
			} catch (error: RuntimeException) {
				// ForegroundServiceStartNotAllowedException (API 31+) é IllegalStateException: app em segundo plano.
				synchronized(lock) { shouldRun = false }
				logger?.log(LogLevel.WARN, "SyncForegroundService/start", "Could not start foreground service, sync continues without it: ${error.javaClass.simpleName}: ${error.message}")
			}
		}

		/**
		 * Desce o serviço. Não usa `stopService`: se o `onStartCommand` ainda não rodou, quem para é ele mesmo
		 * (depois de chamar `startForeground`), o que evita a exceção de "did not call startForeground".
		 */
		fun stop() {
			synchronized(lock) {
				shouldRun = false
				instance?.stopSelfNow()
			}
		}

		private fun ensureChannel(context: Context) {
			val manager = context.getSystemService(NotificationManager::class.java) ?: return
			if (manager.getNotificationChannel(CHANNEL_ID) != null) return
			val channel = NotificationChannel(CHANNEL_ID, "Sincronização do relógio", NotificationManager.IMPORTANCE_LOW)
			channel.description = "Aparece enquanto o histórico do relógio é sincronizado"
			manager.createNotificationChannel(channel)
		}

		private fun buildNotification(context: Context): Notification {
			val builder = Notification.Builder(context, CHANNEL_ID)
			val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
			val contentIntent = launch?.let {
				android.app.PendingIntent.getActivity(context, 0, it, android.app.PendingIntent.FLAG_IMMUTABLE)
			}
			return builder
				.setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
				.setContentTitle("Sincronizando relógio")
				.setContentText("Lendo o histórico do relógio")
				.setOngoing(true)
				.setContentIntent(contentIntent)
				.build()
		}
	}
}

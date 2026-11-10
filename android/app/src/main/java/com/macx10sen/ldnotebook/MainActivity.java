package com.macx10sen.ldnotebook;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Latter Day Notebook as its own Android app.
 *
 * It shows the live site in a WebView owned by this app (not Chrome), so app
 * blockers and screen-time tools see it as "LDNotebook". The site's service
 * worker keeps it working offline after the first launch, and site updates
 * arrive without reinstalling. A small bridge (window.LDNotebook) gives the
 * page Android's share sheet and lets it color the system bars.
 */
public class MainActivity extends Activity {

    static final String START_URL = "https://macx10sen.github.io/LDS-Notes/";
    static final String APP_HOST = "macx10sen.github.io";
    static final String APP_PATH = "/LDS-Notes/";
    private static final int FILE_REQUEST = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(getColor(R.color.paper));
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " LDNotebookApp/1");

        webView.addJavascriptInterface(new Bridge(), "LDNotebook");
        webView.setWebViewClient(new AppClient());
        webView.setWebChromeClient(new ChromeClient());

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    static boolean isAppUrl(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null && uri.getPath().toLowerCase().startsWith(APP_PATH.toLowerCase());
    }

    private class AppClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isAppUrl(uri)) return false;
            // Anything else opens outside the app.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                // nothing can open it
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            // First launch with no connection: the offline copy isn't saved yet.
            if (request.isForMainFrame()) view.loadUrl("file:///android_asset/offline.html");
        }
    }

    private class ChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("*/*"); // backups may be .json or .txt
            try {
                startActivityForResult(Intent.createChooser(pick, "Choose a backup"), FILE_REQUEST);
                return true;
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /** Methods the page can call as window.LDNotebook.*. */
    private class Bridge {
        @JavascriptInterface
        public void shareText(String title, String text) {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_SUBJECT, title);
            send.putExtra(Intent.EXTRA_TEXT, text);
            Intent chooser = Intent.createChooser(send, title);
            runOnUiThread(() -> startActivity(chooser));
        }

        @JavascriptInterface
        public boolean shareFile(String name, String mime, String content) {
            try {
                File dir = new File(getCacheDir(), "shared");
                if (!dir.exists() && !dir.mkdirs()) return false;
                File file = new File(dir, name.replaceAll("[^A-Za-z0-9._-]", "_"));
                try (OutputStream out = new FileOutputStream(file)) {
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", file);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, name);
                send.setClipData(ClipData.newRawUri(name, uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "Save backup");
                runOnUiThread(() -> startActivity(chooser));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Colors the status and navigation bars to match the Appearance setting. */
        @JavascriptInterface
        public void setSystemBars(String color, boolean lightBackground) {
            final int c;
            try {
                c = Color.parseColor(color);
            } catch (IllegalArgumentException e) {
                return;
            }
            runOnUiThread(() -> {
                Window w = getWindow();
                w.setStatusBarColor(c);
                w.setNavigationBarColor(c);
                View decor = w.getDecorView();
                WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(w, decor);
                bars.setAppearanceLightStatusBars(lightBackground);
                bars.setAppearanceLightNavigationBars(lightBackground);
                webView.setBackgroundColor(c);
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        // Lets the page save (it saves when it becomes hidden).
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}

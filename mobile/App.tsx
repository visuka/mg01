// Phone app shell: the whole game runs in a WebView from one packed HTML page (tools/build-mobile.js).
import { useEffect, useRef } from 'react';
import { BackHandler, Linking, StyleSheet, Vibration } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { GAME_HTML } from './game/game-html';

const CONSOLE = '#0b1322';
// A stable https origin so the game's saved progress (localStorage) survives app restarts.
const BASE_URL = 'https://mg01.neutcrafts.app/';

type Msg = { t: 'vibrate'; p: number | number[] } | { t: 'back'; handled: boolean };

// react-native-webview 14 declares `WebView<P = undefined>` with props `WebViewProps & P`; under TypeScript 6
// `& undefined` collapses to `never`, so the extra-props parameter is passed as `object` explicitly.
type GameWebView = WebView<object>;

export default function App() {
  const web = useRef<GameWebView>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Ask the game to close its top panel; it answers with a 'back' message.
      web.current?.injectJavaScript(
        "(function(){var h=window.MG_BACK?window.MG_BACK():false;window.ReactNativeWebView.postMessage(JSON.stringify({t:'back',handled:h}));})();true;",
      );
      return true;
    });
    return () => sub.remove();
  }, []);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: Msg;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.t === 'vibrate') {
      // Web pattern is [on, off, on, ...]; Android's starts with a wait.
      if (Array.isArray(msg.p)) Vibration.vibrate([0, ...msg.p]);
      else Vibration.vibrate(msg.p);
    } else if (msg.t === 'back' && !msg.handled) {
      BackHandler.exitApp();
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="light" />
        <WebView<object>
          ref={web}
          style={styles.root}
          source={{ html: GAME_HTML, baseUrl: BASE_URL }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          overScrollMode="never"
          bounces={false}
          textZoom={100}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(req: { url: string }) => {
            // Keep the game in the app; open any outside link in the browser.
            if (req.url.startsWith(BASE_URL) || req.url.startsWith('about:') || req.url.startsWith('data:')) return true;
            Linking.openURL(req.url);
            return false;
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CONSOLE },
});

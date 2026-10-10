/**
 * Roda no CI depois de `cap add android`: faixa da barra de status/navegação na cor do app,
 * com ícones claros (o tema padrão DayNight deixaria a faixa branca no modo claro do celular).
 */
import { readFileSync, writeFileSync } from "node:fs";

const arquivo = "android/app/src/main/res/values/styles.xml";
const xml = readFileSync(arquivo, "utf8");
const marcador = '<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">';
if (!xml.includes(marcador)) throw new Error(`tema não encontrado em ${arquivo}`);

const itens = [
  '<item name="android:windowBackground">#ff020617</item>',
  '<item name="android:statusBarColor">#ff020617</item>',
  '<item name="android:navigationBarColor">#ff020617</item>',
  '<item name="android:windowLightStatusBar">false</item>',
].map((i) => `\n        ${i}`).join("");

writeFileSync(arquivo, xml.replace(marcador, marcador + itens));
console.log(`tema ajustado em ${arquivo}`);

// eslint-disable-next-line import/prefer-default-export
export async function sendForTranslation(sourceHtml, toLang) {
  const body = new FormData();
  body.append('data', sourceHtml);
  body.append('fromlang', 'en');
  body.append('tolang', toLang);

  const opts = { method: 'POST', body };

  const resp = await fetch('https://translate.da.live/translate', opts);
  if (!resp.ok) {
    console.log(resp.status);
    return null;
  }
  const json = await resp.json();
  return json.translated;
}

export async function isConnected() {
  return true;
}

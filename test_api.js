const https = require('https');
const url = 'https://api.qurancdn.com/api/qdc/verses/by_chapter/1?language=en&translations=131,161,57&fields=text_uthmani_tajweed&per_page=1';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.verses?.[0]?.translations) {
      console.log('Translations returned (QDC):', json.verses[0].translations.map(t => ({ id: t.resource_id, name: t.resource_name })));
    } else {
      console.log('No translations in QDC verse 0');
    }
  });
});

/**
 * Normalize URLs to their base path without any language prefix
 *
 * @param {URL} urls the URLs to normalize
 * @param {Array} langs the languages to check URLs against
 * @returns {Array} contextualized urls
 */
export default function normalizeUrls(urls, langs) {
  const fullLangs = langs.filter((lang) => lang.location !== '/');

  return urls.map((url) => {
    const urlLang = fullLangs.find((lang) => url.extPath.startsWith(lang.location));
    const basePath = urlLang ? url.extPath.replace(urlLang.location, '') : url.extPath;
    return {
      langPath: urlLang ? urlLang.location : '/',
      extPath: url.extPath,
      basePath,
    };
  });
}

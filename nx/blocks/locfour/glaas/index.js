import {
  checkSession, createTask, addAssets, updateStatus, getTask, downloadAsset,
} from './api.js';
import { getGlaasToken, connectToGlaas } from './auth.js';

let token;

export async function isConnected(service) {
  token = await getGlaasToken(service);
  if (token) {
    const sessionConf = { ...service, token };
    const status = await checkSession(sessionConf);
    if (status === 200) return true;
  }
  return false;
}

export async function connect(config) {
  localStorage.setItem('currentProject', window.location.hash);
  connectToGlaas(config.origin, config.clientid);
}

function langs2tasks(title, langs, timestamp) {
  return langs.reduce((acc, lang) => {
    if (lang.workflowName === '') return acc;
    if (acc[lang.workflowName]) {
      acc[lang.workflowName].langs.push(lang);
    } else {
      acc[lang.workflowName] = {
        status: lang.translation?.status || 'not started',
        name: lang.translation?.name || `${title.toLowerCase()}-${timestamp}`,
        timestamp,
        workflowName: lang.workflowName,
        workflow: lang.workflow,
        langs: [lang],
      };
    }
    return acc;
  }, {});
}

async function addTaskAssets(service, task, items, setStatus) {
  setStatus(`Uploading docs to GLaaS for project: ${task.name}.`);
  const { origin, clientid } = service;
  const conf = {
    origin,
    clientid,
    token,
    task,
    items,
    setStatus,
  };
  const result = await addAssets(conf);
  return result;
}

async function createNewTask(service, task, setStatus) {
  setStatus(`Creating task ${task.name} using ${task.workflowName}.`);

  const { origin, clientid } = service;
  const result = await createTask({ origin, clientid, token, task });
  return { ...result, status: 'draft' };
}

async function updateLangTask(task, langs, setStatus) {
  setStatus(`Saving ${task.name} details in project.`);
  langs.forEach((lang) => {
    if (lang.workflow === task.workflow) {
      lang.translation = {
        sent: task.sent,
        error: task.error,
        name: task.name,
        status: task.status,
      };
    }
  });
}

export async function sendAllLanguages(details, service, langs, urls, actions) {
  const { setStatus, saveState } = actions;

  // const timestamp = window.location.hash.split('/').pop();
  const timestamp = Date.now();

  const tasks = langs2tasks(details.title, langs, timestamp);

  for (const key of Object.keys(tasks)) {
    let task = tasks[key];
    task.targetLocales ??= task.langs.map((lang) => lang.code);

    // Only create a task if it has not been started
    if (task.status === 'not started') {
      task = await createNewTask(service, task, setStatus);
      if (task.error) {
        setStatus(`${task.error} - ${task.status}`);
        return;
      }
      updateLangTask(task, langs, setStatus);
      await saveState();
    }

    // Only add assets if task is in draft form
    if (task.status === 'draft') {
      await addTaskAssets(service, task, urls, setStatus);
      updateLangTask(task, langs, setStatus);
      await saveState();
    }

    // Only wrap up task if everything is uploaded
    if (task.status === 'uploaded') {
      await updateStatus(service, token, task);
      updateLangTask(task, langs, setStatus);
      await saveState();
    }
  }
}

export async function getStatusAll(service, langs, actions) {
  const { setStatus, saveState } = actions;

  const tasks = langs2tasks(null, langs);

  const baseConf = { ...service, token };

  const statuses = (await Promise.all(Object.keys(tasks).map((key) => {
    const task = tasks[key];

    setStatus(`Getting status for task ${task.name} (${task.langs.length} languages)`);

    const taskConf = { ...baseConf, ...task };
    return getTask(taskConf);
  }, []))).flat();

  langs.forEach((lang) => {
    if (lang.translation.status !== 'complete') {
      const { assets } = statuses.find((task) => task.targetLocale === lang.code);
      const translated = assets.filter((asset) => asset.status === 'COMPLETED').length;
      if (assets.length === translated) {
        lang.translation.status = 'translated';
      }
      lang.translation.translated = translated;
    }
  });
  await saveState();
}

export async function getItems(service, lang, urls) {
  const { translation, workflow, code } = lang;
  const task = { name: translation.name, workflow, code };

  return Promise.all(urls.map(async (url) => {
    const blob = await downloadAsset(service, token, task, url.basePath);
    return { ...url, blob };
  }));
}

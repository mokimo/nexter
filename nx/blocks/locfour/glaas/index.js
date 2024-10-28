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

async function updateLangTask(task, langs) {
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

async function addTaskAssets(service, langs, task, items, actions) {
  actions.setStatus(`Uploading items to GLaaS for project: ${task.name}.`);
  const { origin, clientid } = service;
  const conf = {
    origin,
    clientid,
    token,
    langs,
    task,
    items,
  };
  const assetActions = { ...actions, updateLangTask };
  const result = await addAssets(conf, assetActions);
  return result;
}

async function createNewTask(service, task, setStatus) {
  setStatus(`Creating task ${task.name} using ${task.workflowName}.`);

  const { origin, clientid } = service;
  const result = await createTask({ origin, clientid, token, task });
  return { ...result, status: 'draft' };
}

async function sendLanguage(service, suppliedTask, langs, urls, actions) {
  const { setStatus, saveState } = actions;
  let task = suppliedTask;

  task.targetLocales ??= task.langs.map((lang) => lang.code);

  // Only create a task if it has not been started
  if (task.status === 'not started') {
    task = await createNewTask(service, task, setStatus);
    if (task.error) {
      setStatus(`${task.error} - ${task.status}`);
      return;
    }
    updateLangTask(task, langs);
    await saveState();
  }

  // Only add assets if task is not uploaded
  if (task.status !== 'uploaded') {
    task.status = 'sending';
    updateLangTask(task, langs);
    await addTaskAssets(service, langs, task, urls, actions);
    updateLangTask(task, langs);
    await saveState();
  }

  // Only wrap up task if everything is uploaded
  if (task.status === 'uploaded') {
    await updateStatus(service, token, task);
    updateLangTask(task, langs);
    await saveState();
  }
}

export async function sendAllLanguages(title, service, langs, urls, actions) {
  // const timestamp = window.location.hash.split('/').pop();
  const timestamp = Date.now();

  const tasks = langs2tasks(title, langs, timestamp);

  for (const key of Object.keys(tasks)) {
    await sendLanguage(service, tasks[key], langs, urls, actions);
  }
}

export async function getStatusAll(title, service, langs, urls, actions) {
  const { setStatus, saveState } = actions;

  const tasks = langs2tasks(title, langs);

  const baseConf = { ...service, token };

  // Check for failed uploads
  for (const key of Object.keys(tasks)) {
    const task = tasks[key];
    if (task.status === 'sending') {
      const statuses = await getTask({ ...baseConf, ...task });
      const uploadedUrls = statuses[0].assets.map((asset) => asset.name);
      const remainingUrls = urls.reduce((acc, url) => {
        const found = uploadedUrls.find((upload) => upload === url.basePath);
        if (!found) acc.push(url);
        return acc;
      }, []);
      task.sent = uploadedUrls.length;
      await sendLanguage(service, task, langs, remainingUrls, actions);
    }
  }

  const statuses = (await Promise.all(Object.keys(tasks).map(async (key) => {
    const task = tasks[key];

    setStatus(`Getting status for task ${task.name} (${task.langs.length} languages)`);

    const taskConf = { ...baseConf, ...task };
    return getTask(taskConf);
  }, []))).flat();

  langs.forEach((lang) => {
    const task = statuses.find((status) => status.targetLocale === lang.code);
    if (lang.translation.status !== 'complete') {
      lang.translation.sent = task.assets.length;
      lang.translation.status = task.status.toLowerCase();
      const translated = task.assets.filter((asset) => asset.status === 'COMPLETED').length;
      if (task.assets.length === translated) {
        lang.translation.status = 'translated';
      }
      lang.translation.translated = translated;
    }
  });
  saveState();
  setStatus();
}

export async function getItems(service, lang, urls) {
  const { translation, workflow, code } = lang;
  const task = { name: translation.name, workflow, code };

  return Promise.all(urls.map(async (url) => {
    const blob = await downloadAsset(service, token, task, url.basePath);
    return { ...url, blob };
  }));
}

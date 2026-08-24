import { WORKFLOW_HISTORY_LIMIT } from "@shared/workflow-history";

const DATABASE_NAME = "youtube-pro-workflows";
const DATABASE_VERSION = 1;
const STORE_NAME = "workflows";

export interface StoredWorkflowRecord<T> {
  id: string;
  createdAt: number;
  updatedAt: number;
  state: T;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Workflow storage request failed"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Workflow storage transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("Workflow storage transaction was aborted"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this browser"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Workflow storage could not be opened"));
  });
}

export async function listWorkflowRecords<T>(): Promise<StoredWorkflowRecord<T>[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll()) as StoredWorkflowRecord<T>[];
    await completion;
    return records.sort((left, right) => right.updatedAt - left.updatedAt);
  } finally {
    database.close();
  }
}

export async function getWorkflowRecord<T>(id: string): Promise<StoredWorkflowRecord<T> | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(id)) as StoredWorkflowRecord<T> | undefined;
    await completion;
    return record || null;
  } finally {
    database.close();
  }
}

export async function putWorkflowRecord<T>(record: StoredWorkflowRecord<T>): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).put(record);
    await completion;
  } finally {
    database.close();
  }
}

export async function deleteWorkflowRecord(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).delete(id);
    await completion;
  } finally {
    database.close();
  }
}

export async function pruneWorkflowRecords(limit = WORKFLOW_HISTORY_LIMIT): Promise<string[]> {
  const records = await listWorkflowRecords<unknown>();
  const expired = records.slice(Math.max(0, limit));
  if (expired.length === 0) return [];
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    for (const record of expired) store.delete(record.id);
    await completion;
    return expired.map((record) => record.id);
  } finally {
    database.close();
  }
}

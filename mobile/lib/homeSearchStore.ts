import { useState, useEffect } from "react";
import {
  appendSearchTerm,
  removeSearchTerm,
  toggleSearchTerm,
  replaceSearchQuery,
} from "./searchQuery";

let currentQuery = "";
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function getHomeSearchQuery(): string {
  return currentQuery;
}

export function setHomeSearchQuery(query: string): void {
  const next = query.trim();
  if (next === currentQuery) return;
  currentQuery = next;
  notify();
}

export function replaceHomeSearchTerm(type: string, name: string): string {
  const next = replaceSearchQuery(type, name);
  setHomeSearchQuery(next);
  return next;
}

export function appendHomeSearchTerm(
  type: string,
  name: string
): { query: string; added: boolean; term: string } {
  const result = appendSearchTerm(currentQuery, type, name);
  if (result.added) {
    setHomeSearchQuery(result.query);
  }
  return result;
}

export function removeHomeSearchTerm(
  type: string,
  name: string
): { query: string; removed: boolean; term: string } {
  const result = removeSearchTerm(currentQuery, type, name);
  if (result.removed) {
    setHomeSearchQuery(result.query);
  }
  return result;
}

export function toggleHomeSearchTerm(
  type: string,
  name: string
): { query: string; added: boolean; removed: boolean; term: string } {
  const result = toggleSearchTerm(currentQuery, type, name);
  setHomeSearchQuery(result.query);
  return result;
}

export function useHomeSearch(): {
  query: string;
  setQuery: (query: string) => void;
  appendTerm: (type: string, name: string) => { query: string; added: boolean; term: string };
  removeTerm: (type: string, name: string) => { query: string; removed: boolean; term: string };
  toggleTerm: (type: string, name: string) => { query: string; added: boolean; removed: boolean; term: string };
  replaceTerm: (type: string, name: string) => string;
} {
  const [query, setQuery] = useState(currentQuery);

  useEffect(() => {
    const update = (): void => {
      setQuery(currentQuery);
    };
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    query,
    setQuery: setHomeSearchQuery,
    appendTerm: appendHomeSearchTerm,
    removeTerm: removeHomeSearchTerm,
    toggleTerm: toggleHomeSearchTerm,
    replaceTerm: replaceHomeSearchTerm,
  };
}

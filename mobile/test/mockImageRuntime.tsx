import React from "react";
let ready = false;
let incognito = false;
export function __setIncognito(value: boolean) { incognito = value; }
export function usePrivacy() { return { incognito, ready: true, settings: { allowImageRelay: false } }; }
export function getPrivacySettings() { return { incognito, allowImageRelay: false }; }
export function __setImagePrivacyReady(value: boolean) { ready = value; }
export function useReaderSettings() { return { settings: { blurNsfwCovers: true }, ready }; }
export function Image(props: Record<string, any>) {
  return <img src={props.source.uri} data-recycling-key={props.recyclingKey} data-blur={props.blurRadius} data-cache={props.cachePolicy} />;
}
export async function resolveEhentaiPageImage(uri: string) { return uri; }
export function getCachedEhentaiPageImage() { return undefined; }

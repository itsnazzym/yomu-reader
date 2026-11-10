import React from "react";
let ready = false;
export function __setImagePrivacyReady(value: boolean) { ready = value; }
export function useReaderSettings() { return { settings: { blurNsfwCovers: true }, ready }; }
export function Image(props: Record<string, any>) {
  return <img src={props.source.uri} data-recycling-key={props.recyclingKey} data-blur={props.blurRadius} />;
}
export async function resolveEhentaiPageImage(uri: string) { return uri; }
export function getCachedEhentaiPageImage() { return undefined; }

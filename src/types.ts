export type GoogleResult = {
  title: string;
  link: string;
  snippet?: string;
  displayLink?: string;
  mime?: string;
  image?: {
    contextLink?: string;
    height?: number;
    width?: number;
    byteSize?: number;
    thumbnailLink?: string;
  };
};

export type WebhookPayload = {
  event: string;
  timestamp: string;
  [k: string]: any;
};

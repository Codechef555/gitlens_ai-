import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap { return [{ url: "https://gitlens-ai.example.com", lastModified: new Date(), changeFrequency: "weekly", priority: 1 }]; }

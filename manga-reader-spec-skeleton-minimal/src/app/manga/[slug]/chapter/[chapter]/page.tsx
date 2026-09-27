import React from "react";
import { SAMPLE_CHAPTER_MANIFEST } from "@/features/chapters/sample-data";
import { ReaderView } from "@/features/reader/ReaderView";

interface PageProps {
  params: Promise<{
    slug: string;
    chapter: string;
  }>;
  searchParams?: Promise<{
    page?: string;
  }>;
}

export default async function ChapterReaderPage(props: PageProps) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialPage = searchParams?.page ? parseInt(searchParams.page, 10) : 1;

  return (
    <ReaderView
      manifest={SAMPLE_CHAPTER_MANIFEST}
      initialPage={Number.isFinite(initialPage) ? initialPage : 1}
    />
  );
}

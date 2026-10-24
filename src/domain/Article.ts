export type Article = {
  id: string;
  title: string;
  status: "draft" | "published";
  image: {
    url: string;
    alt: string;
  };
  sections: {
    id: string;
    title: string;
    content: string;
  }[];
};

// npm packages
require('dotenv').config();
const axios = require('axios');

// api creds & endpoint
const STORE_DOMAIN = process.env.DOMAIN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const GRAPHQL_ENDPOINT = `https://${STORE_DOMAIN}/admin/api/2025-04/graphql.json`;

// higher order function for fetching every blog’s Title & HTML bodies from AuraShields
async function queryBlogs() {
    const blogs = await fetchAllBlogs();
    const result = {};
    for (const { id, handle } of blogs) {
        const posts = await fetchAllArticlesForBlog(id);
        result[handle] = posts.map(p => ({
            id:    p.id,
            title: p.title,
            html:  p.body,
        }));
    };
    // console.log(result);
    return result;
};
// queryBlogs();

// higher order function for publishing a new blog on AuraShields
async function publishArticle(blogId, articleData) {

    // the blog ID
    const BLOG_ID = 'gid://shopify/Blog/90648674455';

    // build the article object
    const newArticle = {
        author:  { name: 'kevin heidema' },
        title:   'An Even Fresher Take on EMF Science',
        body:    '<h2>Why This Matters</h2><p>Our deep dive into EMF studies…</p>',
        summary: '<p>Quick summary/excerpt of the article…</p>',
        tags:    ['EMF', 'AuraShields'],
      };
    
    try {

        const articleStatus = await createArticle(BLOG_ID, newArticle);
        console.log('articleStatus: ', articleStatus);

    } catch (error) {
        console.log('Failed to run publishArticle: ', error);
    };
};
// publishArticle();

module.exports = { queryBlogs, publishArticle };

// Callback Functions //

// create new article
async function createArticle(blogId, articleFields) {
    const mutation = `
      mutation CreateArticle($article: ArticleCreateInput!) {
        articleCreate(article: $article) {
          article {
            id
            title
            handle
            publishedAt
            body       # HTML body content
            summary    # excerpt/summary
            tags
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
  
    // Build the variables payload exactly as Shopify expects:
    const variables = {
        article: {
            blogId,
            ...articleFields
        }
    };

    const data = await graphqlRequest(mutation, variables);
    const payload = data.articleCreate;

    if (payload.userErrors.length) {
      const messages = payload.userErrors
        .map(err => `${err.field.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(`ArticleCreate failed: ${messages}`);
    };

    return payload.article;
};

// fetch all articles for a single blog
async function fetchAllArticlesForBlog(blogId) {
    const all = [];
    let cursor = null;
    do {
        const { articles, hasNextPage, endCursor } = await fetchArticlesPage(blogId, {
            first: 250,
            after: cursor,
        });
        all.push(...articles);
        cursor = hasNextPage ? endCursor : null;
    } while (cursor);
    return all;
};

// the query structure to get the HTML for each blog
async function fetchArticlesPage(blogId, { first = 50, after = null } = {}) {

    // the query to get the idm, title, and body of the blog
    const query = `
        query Articles($blogId: ID!, $first: Int!, $after: String) {
        blog(id: $blogId) {
            articles(first: $first, after: $after) {
            edges {
                node {
                id
                title
                body     # ← Admin API field for the HTML body
                }
            }
            pageInfo { hasNextPage endCursor }
            }
        }
        }
    `;
    
    const vars = { blogId, first, after };
    const data = await graphqlRequest(query, vars);

    // loop over each recieved article
    const articles = data.blog.articles.edges.map(e => ({
        id:    e.node.id,
        title: e.node.title,
        body:  e.node.body,
    }));

    const pageInfo = data.blog.articles.pageInfo;
    console.log('pageInfo: ', pageInfo);
    return {
        articles,
        hasNextPage: pageInfo.hasNextPage,
        endCursor:   pageInfo.endCursor,
    };
};

// fetch all available blogs
async function fetchAllBlogs() {

    const all = [];
    let cursor = null;

    // query Shopify till we get all the cursors/pages
    do {
        const { blogs, hasNextPage, endCursor } = await fetchBlogsPage({
            first: 250,
            after: cursor, // cursor is where you last off from the last cursors/pages query
        });
        all.push(...blogs);
        cursor = hasNextPage ? endCursor : null;
        
        // if hasNextPage is true, it will continue the loop
    } while (cursor);

    /// console.log('All blogs: ', all);
    return all;
};

// structure the query and loop over pages
async function fetchBlogsPage({ first = 50, after = null } = {}) {

    // graphQl query structure
    const query = `
        query Blogs($first: Int!, $after: String) {
            blogs(first: $first, after: $after) {
            edges {
                node {
                id
                title
                handle
                createdAt
                }
            }
            pageInfo {
                hasNextPage
                endCursor
            }
            }
        }
    `;

    // 
    const variables = { first, after };
    const data = await graphqlRequest(query, variables);

    const edges = data.blogs.edges;
    const blogs = edges.map(edge => {

        const { id, title, handle, createdAt } = edge.node;
        
        const storefrontUrl = `https://${STORE_DOMAIN}/blogs/${handle}`;
        return { id, title, handle, createdAt, storefrontUrl };
    });

    const { hasNextPage, endCursor } = data.blogs.pageInfo;
    return { blogs, hasNextPage, endCursor };
};

// grapgQL Callback function
async function graphqlRequest(query, variables = {}) {
    try {
        const res = await axios.post(
            GRAPHQL_ENDPOINT,
            { query, variables },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': ACCESS_TOKEN,
                }
            }
        );

        if (res.data.errors) {
            // Shopify returns 200 on GraphQL errors, so throw here
            throw new Error(res.data.errors.map(e => e.message).join('; '));
        };

        return res.data.data;
    } catch (err) {
        console.error('Shopify request failed:', err.message);
        throw err;
    };
};
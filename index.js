// npm packages

// external js files
const queryBlogs = require('./shopifyBlogs');

async function runAi() {

    try {

        // query Shopify for the list of blog categories
        const allBlogs = await queryBlogs();
        console.log('The fetched blogs: ', allBlogs);

        // get ai to return a json object with following keys & values:
            // - title
            // - body (in HTML format)
            // - meta title
            // - meta description

        // extract values, add to object to add to Shopify blogs

        // add to Shopify blogs

        console.log('✅ Successfully ran rinAi');

    } catch (error) {
        console.log('❌ failed to run the runAi function');
    };
};
runAi();
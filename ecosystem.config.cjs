module.exports = {

  apps: [{

    name: "starcrm",

    cwd: "/home/ubuntu/star-crm",

    script: "./artifacts/api-server/dist/index.mjs",

    node_args: "--enable-source-maps",



    env: {

      NODE_ENV: "production",

      PORT: 5000,

      NEON_DATABASE_URL: "postgresql://starcrmdb:96cTz9bUFxqfgHd@starcrmdb.cgfq24ieuwap.us-east-1.rds.amazonaws.com:5432/starcrmdb?sslmode=require&uselibpqcompat=true"

    }

  }]

};

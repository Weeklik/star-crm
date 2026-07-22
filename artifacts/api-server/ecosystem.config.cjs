module.exports = {

  apps: [

    {

      name: "starcrm",

      script: "./dist/index.mjs",

      cwd: "/home/ubuntu/star-crm/artifacts/api-server",

      node_args: "--enable-source-maps",

      instances: 1,

      exec_mode: "fork",



      env: {

        NODE_ENV: "production",

        PORT: 5000,

        NEON_DATABASE_URL: "postgresql://starcrmdb:96cTz9bUFxqfgHd@starcrmdb.cgfq24ieuwap.us-east-1.rds.amazonaws.com:5432/starcrmdb?sslmode=require&uselibpqcompat=true"

      }

    }

  ]

};

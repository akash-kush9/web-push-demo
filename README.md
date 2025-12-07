# web-push-demo
backend to test web-push-demo

craete .env file at root


# MongoDB Atlas Connection String (Replace <username> and <password>)
# MONGO_URI='mongodb+srv://<username>:<password>@cluster0.bbxunvx.mongodb.net/?appName=<Cluster_name>&retryWrites=true&w=majority'

# VAPID Keys (Generate these using 'npx web-push generate-vapid-keys')
VAPID_PUBLIC_KEY='Generated_Public_key'
VAPID_PRIVATE_KEY='Generated_Private_key'

# Your email for VAPID identification
VAPID_SUBJECT='mailto:account@gmail.com' 

PORT=3000

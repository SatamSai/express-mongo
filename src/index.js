import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './db/index.js';

dotenv.config({
    path: './env'
})
connectDB()


// import express from 'express'

// const app = express()
// const port = process.env.PORT

// (async() => {
//     try{
//         await mongoose.connect(`${process.env.MONGO_URL}/${DB_NAME}`)
//         app.on("error", (error)=> {
//             console.log("ERROR: ",error)
//             throw error
//         })
//         app.listen(port, ()=> {
//             console.log("Server running at: " + port)
//         })
//     }catch(error){
//         console.error("ERROR: ",error)
//         throw err
//     }
// })()
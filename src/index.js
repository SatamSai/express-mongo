import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './db/index.js';
import { app } from './app.js';

const port = process.env.PORT || 8080

dotenv.config({
    path: './env'
})
connectDB()
.then(() => {
    app.listen(port, () => {
        console.log("Server is running at "+ port)
    })
})
.catch(err => {
    console.log("Failed!!! " + err)
})


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
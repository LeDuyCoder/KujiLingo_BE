import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import crypto from "node:crypto";

async function main() {
    console.log("Starting seed for Courses module...");

    const sampleCourses = [
        {
            id: "11111111-1111-4111-b111-111111111111",
            title: "JLPT N5 Complete Foundation",
            description: "Master Japanese from N5 with structured, intuitive lessons designed for modern learners.",
            image: "https://cdn.kujilingo.com/covers/n5.png",
            order_no: 1,
            lessonsCount: 120,
        },
        {
            id: "22222222-2222-4222-b222-222222222222",
            title: "JLPT N4 Intermediate Path",
            description: "Take the next step in your Japanese journey with intermediate grammar, Kanji, and vocab.",
            image: "https://cdn.kujilingo.com/covers/n4.png",
            order_no: 2,
            lessonsCount: 150,
        },
        {
            id: "33333333-3333-4333-b333-333333333333",
            title: "JLPT N3 Advanced Grammar",
            description: "Deep dive into complex grammar rules and vocabulary to pass the JLPT N3 exam.",
            image: "https://cdn.kujilingo.com/covers/n3.png",
            order_no: 3,
            lessonsCount: 200,
        },
        {
            id: "44444444-4444-4444-b444-444444444444",
            title: "JLPT N2 Business & Daily",
            description: "Prepare for high-level conversations and reading materials for business and daily life.",
            image: "https://cdn.kujilingo.com/covers/n2.png",
            order_no: 4,
            lessonsCount: 250,
        },
    ];

    for (const c of sampleCourses) {
        await prisma.courses.upsert({
            where: { id: c.id },
            update: {
                title: c.title,
                description: c.description,
                image: c.image,
                order_no: c.order_no,
            },
            create: {
                id: c.id,
                title: c.title,
                description: c.description,
                image: c.image,
                order_no: c.order_no,
            },
        });

        const currentCount = await prisma.lessons.count({ where: { course_id: c.id } });
        if (currentCount < c.lessonsCount) {
            console.log(`Seeding ${c.lessonsCount - currentCount} lessons for ${c.title}...`);
            const lessonsData = [];
            for (let i = currentCount + 1; i <= c.lessonsCount; i++) {
                lessonsData.push({
                    id: crypto.randomUUID(),
                    course_id: c.id,
                    title: `Lesson ${i} for ${c.title.replace("JLPT ", "")}`,
                    order_no: i,
                });
            }
            for (let j = 0; j < lessonsData.length; j += 50) {
                const batch = lessonsData.slice(j, j + 50);
                await prisma.lessons.createMany({ data: batch });
            }
        }
    }

    console.log("Courses and lessons seed completed successfully!");
}

main().catch(err => {
    console.error("Courses seed error:", err);
    process.exit(1);
});

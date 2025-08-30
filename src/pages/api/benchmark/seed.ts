import type { NextApiRequest, NextApiResponse } from "next";
import { neon } from '@neondatabase/serverless';
import { env } from "~/env";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sql = neon(env.DATABASE_URL);
    
    // Clear existing data
    await sql`DELETE FROM comments`;
    await sql`DELETE FROM posts`;
    await sql`DELETE FROM users`;
    await sql`DELETE FROM benchmark_results`;

    // Insert users
    const users = await sql`
      INSERT INTO users (email, name) VALUES
        ('alice@example.com', 'Alice Johnson'),
        ('bob@example.com', 'Bob Smith'),
        ('charlie@example.com', 'Charlie Brown'),
        ('diana@example.com', 'Diana Prince'),
        ('edward@example.com', 'Edward Norton')
      RETURNING id, email, name
    `;

    // Insert posts for each user
    for (const user of users) {
      const posts = await sql`
        INSERT INTO posts (user_id, title, content) VALUES
          (${user.id}, 'Getting Started with Next.js', 'Next.js is a powerful React framework...'),
          (${user.id}, 'Understanding TypeScript', 'TypeScript adds type safety to JavaScript...'),
          (${user.id}, 'Database Performance Tips', 'Optimizing database queries is crucial...')
        RETURNING id
      `;

      // Insert comments for each post
      for (const post of posts) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        if (randomUser) {
          await sql`
            INSERT INTO comments (post_id, user_id, content) VALUES
              (${post.id}, ${randomUser.id}, 'Great article! Very helpful.'),
              (${post.id}, ${randomUser.id}, 'Thanks for sharing this information.')
          `;
        }
      }
    }

    // Get counts
    const [userCount] = await sql`SELECT COUNT(*) as count FROM users`;
    const [postCount] = await sql`SELECT COUNT(*) as count FROM posts`;
    const [commentCount] = await sql`SELECT COUNT(*) as count FROM comments`;

    res.status(200).json({
      success: true,
      message: "Database seeded successfully",
      data: {
        users: userCount ? Number(userCount.count) : 0,
        posts: postCount ? Number(postCount.count) : 0,
        comments: commentCount ? Number(commentCount.count) : 0
      }
    });
  } catch (error) {
    console.error("Seed error:", error);
    res.status(500).json({
      error: "Failed to seed database",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateProfileSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    age: z.number().nullable().optional(),
    occupation: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
});

// GET /api/profile — Fetch current user's profile
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            image: true,
            provider: true,
            bio: true,
            location: true,
            dateOfBirth: true,
            age: true,
            occupation: true,
            createdAt: true,
        },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
}

// PUT /api/profile — Update current user's profile
export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const data = updateProfileSchema.parse(body);

        const updateData: Record<string, any> = {};
        if (data.firstName !== undefined) updateData.firstName = data.firstName;
        if (data.lastName !== undefined) updateData.lastName = data.lastName;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.occupation !== undefined) updateData.occupation = data.occupation;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.bio !== undefined) updateData.bio = data.bio;
        if (data.age !== undefined) updateData.age = data.age;
        if (data.dateOfBirth !== undefined) {
            updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
        }

        const updated = await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                image: true,
                bio: true,
                location: true,
                dateOfBirth: true,
                age: true,
                occupation: true,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation failed", details: error.issues },
                { status: 400 }
            );
        }
        console.error("Profile update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE /api/profile — Delete current user's account
export async function DELETE() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.delete({ where: { id: session.user.id } });
    return NextResponse.json({ message: "Account deleted" });
}

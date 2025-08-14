BEGIN;

-- Create manga table
CREATE TABLE public.manga (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    author TEXT,
    artist TEXT,
    status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed', 'hiatus', 'cancelled')),
    submission_status TEXT DEFAULT 'pending' CHECK (submission_status IN ('pending', 'approved', 'rejected')),
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rating FLOAT DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create manga_genres table for many-to-many relationship
CREATE TABLE public.manga_genres (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    manga_id INTEGER REFERENCES public.manga(id) ON DELETE CASCADE NOT NULL,
    genre TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create chapters table
CREATE TABLE public.chapters (
    id SERIAL PRIMARY KEY,
    manga_id INTEGER REFERENCES public.manga(id) ON DELETE CASCADE NOT NULL,
    chapter_number FLOAT NOT NULL,
    title TEXT,
    pages_count INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(manga_id, chapter_number)
);

-- Create manga_ratings table
CREATE TABLE public.manga_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    manga_id INTEGER REFERENCES public.manga(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(manga_id, user_id)
);

-- Create manga_comments table
CREATE TABLE public.manga_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    manga_id INTEGER REFERENCES public.manga(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Update user_favorites to reference the new manga table
ALTER TABLE public.user_favorites 
DROP CONSTRAINT IF EXISTS user_favorites_manga_id_fkey,
ADD CONSTRAINT user_favorites_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.manga(id) ON DELETE CASCADE;

-- Update reading_history to reference the new manga and chapters tables
ALTER TABLE public.reading_history 
DROP CONSTRAINT IF EXISTS reading_history_manga_id_fkey,
ADD CONSTRAINT reading_history_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.manga(id) ON DELETE CASCADE,
ADD CONSTRAINT reading_history_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;

-- Set up Row Level Security (RLS)
ALTER TABLE public.manga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manga_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manga_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manga_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for manga table
CREATE POLICY "Approved manga are viewable by everyone." ON public.manga
    FOR SELECT USING (submission_status = 'approved');

CREATE POLICY "Users can view their own submissions." ON public.manga
    FOR SELECT USING (auth.uid() = submitted_by);

CREATE POLICY "Moderators and admins can view all manga." ON public.manga
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('moderator', 'admin')
        )
    );

CREATE POLICY "Users can insert manga submissions." ON public.manga
    FOR INSERT WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can update their own pending submissions." ON public.manga
    FOR UPDATE USING (
        auth.uid() = submitted_by 
        AND submission_status = 'pending'
    );

CREATE POLICY "Moderators and admins can update manga status." ON public.manga
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('moderator', 'admin')
        )
    );

-- Create policies for manga_genres table
CREATE POLICY "Manga genres are viewable with manga." ON public.manga_genres
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.manga 
            WHERE id = manga_id 
            AND (
                submission_status = 'approved' 
                OR submitted_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('moderator', 'admin')
                )
            )
        )
    );

CREATE POLICY "Users can insert genres for their manga." ON public.manga_genres
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.manga 
            WHERE id = manga_id 
            AND submitted_by = auth.uid()
        )
    );

-- Create policies for chapters table
CREATE POLICY "Approved chapters are viewable by everyone." ON public.chapters
    FOR SELECT USING (
        status = 'approved' 
        AND EXISTS (
            SELECT 1 FROM public.manga 
            WHERE id = manga_id 
            AND submission_status = 'approved'
        )
    );

CREATE POLICY "Users can view their own chapter uploads." ON public.chapters
    FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Moderators and admins can view all chapters." ON public.chapters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('moderator', 'admin')
        )
    );

CREATE POLICY "Users can insert chapters for approved manga." ON public.chapters
    FOR INSERT WITH CHECK (
        auth.uid() = uploaded_by
        AND EXISTS (
            SELECT 1 FROM public.manga 
            WHERE id = manga_id 
            AND submission_status = 'approved'
        )
    );

CREATE POLICY "Moderators and admins can update chapter status." ON public.chapters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('moderator', 'admin')
        )
    );

-- Create policies for manga_ratings table
CREATE POLICY "Users can view all ratings." ON public.manga_ratings
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own ratings." ON public.manga_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings." ON public.manga_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings." ON public.manga_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- Create policies for manga_comments table
CREATE POLICY "Users can view all comments." ON public.manga_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments." ON public.manga_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments." ON public.manga_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments." ON public.manga_comments
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Moderators and admins can delete any comments." ON public.manga_comments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('moderator', 'admin')
        )
    );

-- Create triggers for updated_at timestamps
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.manga
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.chapters
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.manga_ratings
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.manga_comments
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create function to update manga rating
CREATE OR REPLACE FUNCTION public.update_manga_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.manga 
    SET 
        rating = (
            SELECT COALESCE(AVG(rating::FLOAT), 0) 
            FROM public.manga_ratings 
            WHERE manga_id = COALESCE(NEW.manga_id, OLD.manga_id)
        ),
        rating_count = (
            SELECT COUNT(*) 
            FROM public.manga_ratings 
            WHERE manga_id = COALESCE(NEW.manga_id, OLD.manga_id)
        )
    WHERE id = COALESCE(NEW.manga_id, OLD.manga_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for rating updates
CREATE TRIGGER update_manga_rating_on_insert
    AFTER INSERT ON public.manga_ratings
    FOR EACH ROW EXECUTE PROCEDURE public.update_manga_rating();

CREATE TRIGGER update_manga_rating_on_update
    AFTER UPDATE ON public.manga_ratings
    FOR EACH ROW EXECUTE PROCEDURE public.update_manga_rating();

CREATE TRIGGER update_manga_rating_on_delete
    AFTER DELETE ON public.manga_ratings
    FOR EACH ROW EXECUTE PROCEDURE public.update_manga_rating();

-- Create indexes for better performance
CREATE INDEX idx_manga_submission_status ON public.manga(submission_status);
CREATE INDEX idx_manga_status ON public.manga(status);
CREATE INDEX idx_manga_submitted_by ON public.manga(submitted_by);
CREATE INDEX idx_manga_genres_manga_id ON public.manga_genres(manga_id);
CREATE INDEX idx_chapters_manga_id ON public.chapters(manga_id);
CREATE INDEX idx_chapters_status ON public.chapters(status);
CREATE INDEX idx_manga_ratings_manga_id ON public.manga_ratings(manga_id);
CREATE INDEX idx_manga_ratings_user_id ON public.manga_ratings(user_id);
CREATE INDEX idx_manga_comments_manga_id ON public.manga_comments(manga_id);

COMMIT;
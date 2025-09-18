from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sqlite3
import pandas as pd
import os
from pathlib import Path

app = FastAPI(title="K-Drama Database API", description="Search and browse Korean dramas")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

def convert_csv_to_sqlite():
    """Convert kdramas.csv to SQLite database"""
    
    # Read CSV file
    csv_file = "kdramas.csv"
    db_file = "kdramas.db"
    
    if not os.path.exists(csv_file):
        raise FileNotFoundError(f"CSV file {csv_file} not found!")
    
    print(f"Reading CSV file: {csv_file}")
    
    # Read CSV with proper handling of encoding and data types
    df = pd.read_csv(csv_file, encoding='utf-8')
    
    # Clean column names - remove any BOM characters and whitespace
    df.columns = df.columns.str.strip().str.replace('﻿', '')
    
    print(f"Loaded {len(df)} records from CSV")
    print(f"Columns: {list(df.columns)}")
    
    # Connect to SQLite database (creates if doesn't exist)
    conn = sqlite3.connect(db_file)
    
    try:
        # Create table with proper schema
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS kdramas (
            tmdb_id INTEGER PRIMARY KEY,
            title TEXT,
            original_title TEXT,
            overview TEXT,
            first_air_date TEXT,
            last_air_date TEXT,
            status TEXT,
            seasons INTEGER,
            episodes REAL,
            average_runtime REAL,
            genres TEXT,
            country TEXT,
            language TEXT,
            network TEXT,
            production TEXT,
            rating REAL,
            vote_count INTEGER,
            popularity REAL,
            main_cast TEXT,
            keywords TEXT,
            poster_path TEXT,
            backdrop_path TEXT
        )
        """
        
        conn.execute(create_table_sql)
        print("Created/verified kdramas table")
        
        # Clear existing data but preserve schema
        conn.execute("DELETE FROM kdramas")
        
        # Insert data using parameterized queries to preserve schema
        insert_sql = """
        INSERT INTO kdramas (
            tmdb_id, title, original_title, overview, first_air_date, last_air_date,
            status, seasons, episodes, average_runtime, genres, country, language,
            network, production, rating, vote_count, popularity, main_cast,
            keywords, poster_path, backdrop_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        # Convert DataFrame to list of tuples for insertion
        data_tuples = [tuple(row) for row in df.values]
        conn.executemany(insert_sql, data_tuples)
        conn.commit()
        
        # Verify data was inserted
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM kdramas")
        count = cursor.fetchone()[0]
        print(f"Successfully inserted {count} records into SQLite database")
        
        # Show sample data
        cursor.execute("SELECT title, original_title, rating, genres FROM kdramas LIMIT 5")
        sample_data = cursor.fetchall()
        print("\nSample data from SQLite:")
        for row in sample_data:
            print(f"- {row[0]} ({row[1]}) - Rating: {row[2]} - Genres: {row[3]}")
        
        # Show some statistics
        cursor.execute("SELECT AVG(rating) as avg_rating, MAX(rating) as max_rating, MIN(rating) as min_rating FROM kdramas WHERE rating > 0")
        stats = cursor.fetchone()
        print(f"\nRating Statistics:")
        print(f"- Average rating: {stats[0]:.2f}" if stats[0] else "- Average rating: N/A")
        print(f"- Highest rating: {stats[1]}" if stats[1] else "- Highest rating: N/A")
        print(f"- Lowest rating: {stats[2]}" if stats[2] else "- Lowest rating: N/A")
        
        # Count by status
        cursor.execute("SELECT status, COUNT(*) FROM kdramas GROUP BY status ORDER BY COUNT(*) DESC")
        status_counts = cursor.fetchall()
        print(f"\nShows by status:")
        for status, count in status_counts:
            print(f"- {status}: {count}")
        
    except Exception as e:
        print(f"Error during conversion: {e}")
        raise e
    finally:
        conn.close()
    
    print(f"\nConversion complete! SQLite database saved as: {db_file}")

@app.get("/api")
def api_root():
    return {"message": "K-Drama Database API", "status": "ready", "version": "1.0"}

from fastapi.responses import FileResponse

@app.get("/")
def read_root():
    return FileResponse('static/index.html')

@app.post("/convert")
def run_conversion():
    """API endpoint to run the CSV to SQLite conversion"""
    try:
        convert_csv_to_sqlite()
        
        # Verify conversion success by checking record count
        conn = sqlite3.connect("kdramas.db")
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM kdramas")
        count = cursor.fetchone()[0]
        conn.close()
        
        if count == 0:
            raise HTTPException(status_code=500, detail="Conversion failed: No records in database")
        
        return {
            "success": True,
            "message": "Conversion completed successfully", 
            "database": "kdramas.db",
            "records_converted": count
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

@app.get("/search")
def search_dramas(
    q: str = "",
    genre: str = "",
    status: str = "",
    min_rating: float = 0.0,
    limit: int = 20,
    offset: int = 0
):
    """Search K-dramas with filters"""
    try:
        conn = sqlite3.connect("kdramas.db")
        cursor = conn.cursor()
        
        # Build dynamic query based on filters
        where_clauses = []
        params = []
        
        if q.strip():
            where_clauses.append("(title LIKE ? OR original_title LIKE ? OR overview LIKE ? OR main_cast LIKE ?)")
            search_term = f"%{q.strip()}%"
            params.extend([search_term, search_term, search_term, search_term])
        
        if genre.strip():
            where_clauses.append("genres LIKE ?")
            params.append(f"%{genre.strip()}%")
        
        if status.strip():
            where_clauses.append("status = ?")
            params.append(status.strip())
        
        if min_rating > 0:
            where_clauses.append("rating >= ?")
            params.append(min_rating)
        
        # Base query
        base_query = """
        SELECT tmdb_id, title, original_title, overview, first_air_date, status, 
               episodes, rating, genres, network, main_cast, poster_path
        FROM kdramas
        """
        
        if where_clauses:
            base_query += " WHERE " + " AND ".join(where_clauses)
        
        # Add ordering and pagination
        base_query += " ORDER BY rating DESC, popularity DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(base_query, params)
        results = cursor.fetchall()
        
        # Get total count for pagination
        count_query = "SELECT COUNT(*) FROM kdramas"
        count_params = []
        
        if where_clauses:
            count_query += " WHERE " + " AND ".join(where_clauses)
            count_params = params[:-2]  # Remove limit and offset
        
        cursor.execute(count_query, count_params)
        total_count = cursor.fetchone()[0]
        
        conn.close()
        
        # Format results
        dramas = []
        for row in results:
            dramas.append({
                "tmdb_id": row[0],
                "title": row[1],
                "original_title": row[2],
                "overview": row[3],
                "first_air_date": row[4],
                "status": row[5],
                "episodes": row[6],
                "rating": row[7],
                "genres": row[8],
                "network": row[9],
                "main_cast": row[10],
                "poster_path": row[11]
            })
        
        return {
            "dramas": dramas,
            "total": total_count,
            "page_info": {
                "limit": limit,
                "offset": offset,
                "has_more": (offset + limit) < total_count
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/drama/{tmdb_id}")
def get_drama_details(tmdb_id: int):
    """Get detailed information for a specific drama"""
    try:
        conn = sqlite3.connect("kdramas.db")
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM kdramas WHERE tmdb_id = ?", (tmdb_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Drama not found")
        
        # Map result to dict
        columns = [
            'tmdb_id', 'title', 'original_title', 'overview', 'first_air_date', 'last_air_date',
            'status', 'seasons', 'episodes', 'average_runtime', 'genres', 'country', 'language',
            'network', 'production', 'rating', 'vote_count', 'popularity', 'main_cast',
            'keywords', 'poster_path', 'backdrop_path'
        ]
        
        drama = dict(zip(columns, result))
        return drama
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/stats")
def get_database_stats():
    """Get statistics from the SQLite database"""
    try:
        conn = sqlite3.connect("kdramas.db")
        cursor = conn.cursor()
        
        # Get total count
        cursor.execute("SELECT COUNT(*) FROM kdramas")
        total_count = cursor.fetchone()[0]
        
        # Get rating stats
        cursor.execute("SELECT AVG(rating), MAX(rating), MIN(rating) FROM kdramas WHERE rating > 0")
        rating_stats = cursor.fetchone()
        
        # Get top genres
        cursor.execute("SELECT genres, COUNT(*) as count FROM kdramas WHERE genres IS NOT NULL GROUP BY genres ORDER BY count DESC LIMIT 10")
        top_genres = cursor.fetchall()
        
        # Get unique statuses
        cursor.execute("SELECT DISTINCT status FROM kdramas WHERE status IS NOT NULL ORDER BY status")
        statuses = [row[0] for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            "total_dramas": total_count,
            "rating_stats": {
                "average": round(rating_stats[0], 2) if rating_stats[0] else None,
                "highest": rating_stats[1],
                "lowest": rating_stats[2]
            },
            "top_genres": [{"genre": genre, "count": count} for genre, count in top_genres],
            "available_statuses": statuses
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats error: {str(e)}")

if __name__ == "__main__":
    # Run conversion when script is executed directly
    convert_csv_to_sqlite()

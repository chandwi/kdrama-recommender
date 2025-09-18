# K-Drama Database API

## Overview

This project is a FastAPI-based web service that provides access to Korean drama (K-drama) data. The system converts CSV data containing K-drama information into a SQLite database and exposes it through REST API endpoints. The application serves as a data management and query system for K-drama metadata including titles, air dates, genres, networks, and other relevant information.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Framework
- **FastAPI**: Chosen as the web framework for its automatic API documentation, type hints support, and high performance
- **RESTful API Design**: Follows REST principles for predictable and standard API interactions

### Data Storage
- **SQLite Database**: Primary data store for K-drama information
  - Lightweight, serverless database suitable for small to medium datasets
  - No complex setup required, data stored in a single file
  - ACID compliance for data integrity
- **CSV to SQLite Migration**: Built-in data conversion functionality
  - Handles encoding issues (UTF-8, BOM characters)
  - Automated schema creation and data import

### Data Processing
- **Pandas**: Used for CSV data manipulation and cleaning
  - Handles encoding issues and data type conversion
  - Column name sanitization (removes BOM characters and whitespace)
  - Efficient data loading and transformation

### Database Schema
The K-drama table includes fields for:
- Core identifiers (tmdb_id as primary key)
- Metadata (title, original_title, overview)
- Temporal data (air dates, status)
- Content structure (seasons, episodes, runtime)
- Classification (genres, country, language, network)

### Architecture Patterns
- **Single Responsibility**: Clear separation between data conversion and API serving
- **File-based Configuration**: Uses local files for data storage and configuration
- **Error Handling**: Proper exception handling for missing files and data issues

## External Dependencies

### Python Libraries
- **FastAPI**: Web framework for building the REST API
- **Pandas**: Data manipulation and analysis library for CSV processing
- **SQLite3**: Built-in Python library for database operations

### Data Sources
- **CSV Data File**: Source data file (kdramas.csv) containing K-drama information
- **TMDB Integration**: Uses TMDB (The Movie Database) IDs as primary keys, suggesting potential integration with TMDB API

### File System Dependencies
- Local file system for CSV input and SQLite database storage
- UTF-8 encoding support for international character handling
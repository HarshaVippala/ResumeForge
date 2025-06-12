@app.route('/api/emails/sync', methods=['POST'])
def sync_emails():
    """Sync recent emails and process with comprehensive workflow"""
    try:
        # Get request parameters
        data = request.get_json() or {}
        days_back = data.get('days_back', 14)
        max_results = data.get('max_results', 50)
        force_reprocess = data.get('force_reprocess', False)
        
        logger.info(f"EMAIL SYNC: Processing emails from past {days_back} days (max {max_results})")
        
        # Use unified email service for comprehensive processing
        result = unified_email_service.process_emails_comprehensive(
            days_back=days_back,
            max_results=max_results,
            force_reprocess=force_reprocess
        )
        
        if not result['success']:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Email processing failed'),
                'data': {
                    'emails_processed': 0,
                    'email_activities': [],
                    'attention_items': [],
                    'quick_updates': [],
                    'upcoming_events': []
                }
            }), 500
        
        # Get formatted dashboard data
        dashboard_result = unified_email_service.get_email_activities(days_back=days_back, limit=max_results)
        
        return jsonify({
            'success': True,
            'data': dashboard_result.get('data', {}),
            'summary': {
                'total_emails': result.get('total_emails', 0),
                'processed_count': result.get('processed_count', 0),
                'companies_created': result.get('companies_created', 0),
                'contacts_created': result.get('contacts_created', 0),
                'jobs_created': result.get('jobs_created', 0)
            },
            'message': f'Successfully processed {result.get("processed_count", 0)} emails with comprehensive analysis'
        })
        
    except Exception as e:
        logger.error(f"Error syncing emails: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': {
                'emails_processed': 0,
                'email_activities': [],
                'attention_items': [],
                'quick_updates': [],
                'upcoming_events': []
            }
        }), 500
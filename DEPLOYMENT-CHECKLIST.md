# Deployment Checklist

Use this checklist to ensure your Shopify Product Import App is properly configured and ready for production deployment.

## Pre-Deployment Checklist

### 1. Shopify Partner Setup
- [ ] Shopify Partner account created
- [ ] App created in Partner dashboard
- [ ] App name configured
- [ ] App URL set to: `https://produktimport.wemarket.dk`
- [ ] Redirect URL set to: `https://produktimport.wemarket.dk/api/auth/callback`
- [ ] Embedded app enabled
- [ ] Scopes configured: `write_products,read_products`
- [ ] API key and secret noted down

### 2. OpenRouter Setup
- [ ] OpenRouter account created
- [ ] Credits added to account
- [ ] API key generated and saved
- [ ] Test API key with test connection

### 3. Google Cloud VM Setup
- [ ] VM created and accessible
- [ ] Domain pointed to VM IP: produktimport.wemarket.dk
- [ ] SSH access configured
- [ ] Firewall rules configured (ports 22, 80, 443)

### 4. Server Software Installation
- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed and running
- [ ] PM2 installed globally
- [ ] Nginx installed
- [ ] Certbot installed for SSL

### 5. Database Configuration
- [ ] Database created: `shopify_product_import`
- [ ] Database user created with password
- [ ] Database connection tested
- [ ] Connection string prepared
- [ ] Backup strategy planned

### 6. SSL Certificate
- [ ] DNS A record configured for domain
- [ ] SSL certificate obtained via Certbot
- [ ] HTTPS redirect enabled
- [ ] Auto-renewal configured

### 7. GitHub Repository
- [ ] Code pushed to GitHub
- [ ] Repository access granted to team members
- [ ] Branch protection rules configured (optional)

### 8. GitHub Secrets Configuration

Required secrets (in GitHub Settings → Secrets):

- [ ] `GCP_SSH_PRIVATE_KEY` - SSH private key content
- [ ] `GCP_USER` - VM username
- [ ] `GCP_HOST` - produktimport.wemarket.dk
- [ ] `DATABASE_URL` - Full PostgreSQL connection string
- [ ] `SHOPIFY_API_KEY` - From Shopify Partner dashboard
- [ ] `SHOPIFY_API_SECRET` - From Shopify Partner dashboard
- [ ] `SHOPIFY_SCOPES` - `write_products,read_products`
- [ ] `SESSION_SECRET` - Random 64-character hex string

### 9. Environment Variables on Server

Verify these are set correctly in production .env:

- [ ] `SHOPIFY_API_KEY`
- [ ] `SHOPIFY_API_SECRET`
- [ ] `SHOPIFY_SCOPES`
- [ ] `SHOPIFY_APP_URL=https://produktimport.wemarket.dk`
- [ ] `HOST=produktimport.wemarket.dk`
- [ ] `DATABASE_URL`
- [ ] `PORT=3001`
- [ ] `NODE_ENV=production`
- [ ] `SESSION_SECRET`

### 10. Server Directory Structure
- [ ] App directory created: `~/shopify-product-import`
- [ ] Uploads directory writable
- [ ] Logs directory exists
- [ ] Correct file permissions set

## Deployment Checklist

### 1. Initial Deployment
- [ ] Database migrations run successfully
- [ ] Application builds without errors
- [ ] Application starts with PM2
- [ ] PM2 configured to start on boot
- [ ] PM2 configuration saved

### 2. Nginx Configuration
- [ ] Reverse proxy configured
- [ ] Static file serving configured
- [ ] Nginx syntax test passes
- [ ] Nginx reloaded/restarted

### 3. Verification Tests

Run these tests after deployment:

```bash
# Health check
curl https://produktimport.wemarket.dk/health
# Should return: {"status":"ok","timestamp":"..."}

# SSL check
curl -I https://produktimport.wemarket.dk
# Should return: HTTP/2 200 (or HTTP/1.1 200)

# HTTP to HTTPS redirect
curl -I http://produktimport.wemarket.dk
# Should return: 301 redirect to HTTPS

# API endpoint test
curl https://produktimport.wemarket.dk/api/mapping/fields
# Should return JSON with Shopify fields
```

- [ ] Health check passes
- [ ] HTTPS works
- [ ] HTTP redirects to HTTPS
- [ ] API endpoints accessible

### 4. PM2 Verification
- [ ] Application shows as "online" in `pm2 status`
- [ ] No errors in `pm2 logs`
- [ ] Application restarts on crashes
- [ ] Application starts on server reboot

### 5. Database Verification
- [ ] All tables created (5 tables)
- [ ] Indexes created correctly
- [ ] Foreign key constraints working
- [ ] Test data insertion works

### 6. Shopify Integration
- [ ] App installs successfully on test store
- [ ] OAuth flow completes
- [ ] App appears in Shopify admin
- [ ] App loads within Shopify admin

## Post-Deployment Checklist

### 1. Functional Testing

Test each feature:

- [ ] **Settings Page**
  - [ ] OpenRouter API key saves
  - [ ] Model selection works
  - [ ] Test connection succeeds
  - [ ] Settings persist after refresh

- [ ] **Upload CSV**
  - [ ] File upload works
  - [ ] CSV parsing succeeds
  - [ ] Sample data displays correctly
  - [ ] Supplier name required validation

- [ ] **AI Mapping**
  - [ ] AI suggestions load
  - [ ] Confidence scores shown
  - [ ] Manual override works
  - [ ] Validation for required fields

- [ ] **Processing**
  - [ ] Products process successfully
  - [ ] Duplicate EANs detected
  - [ ] SKUs auto-generated
  - [ ] Variants grouped correctly
  - [ ] Descriptions combined properly

- [ ] **Queue Management**
  - [ ] Products appear in queue
  - [ ] Select/deselect works
  - [ ] Select all works
  - [ ] Product details visible

- [ ] **Import to Shopify**
  - [ ] Import modal opens
  - [ ] Import progress shows
  - [ ] Products created in Shopify
  - [ ] Products created as drafts
  - [ ] Variants created correctly
  - [ ] Images uploaded
  - [ ] Descriptions formatted correctly

### 2. Error Handling

Test error scenarios:

- [ ] Invalid CSV format
- [ ] Missing required fields
- [ ] Invalid OpenRouter API key
- [ ] Database connection failure
- [ ] Shopify API errors
- [ ] Large file upload (>10MB)
- [ ] Network timeouts

### 3. Performance Testing

- [ ] CSV with 100 products
- [ ] CSV with 500 products
- [ ] CSV with 1000 products
- [ ] Multiple concurrent uploads
- [ ] Batch import performance

### 4. Security Verification

- [ ] HTTPS enforced everywhere
- [ ] API endpoints require authentication
- [ ] SQL injection protection
- [ ] XSS protection
- [ ] CSRF protection
- [ ] File upload restrictions
- [ ] Environment variables not exposed

### 5. Monitoring Setup

- [ ] PM2 monitoring configured
- [ ] Log rotation enabled
- [ ] Health check monitoring
- [ ] Disk space monitoring
- [ ] Database backup scheduled
- [ ] Error alerting configured (optional)

## Production Readiness

### Before Going Live

- [ ] All checklist items above completed
- [ ] Test store thoroughly tested
- [ ] Documentation reviewed
- [ ] Team trained on app usage
- [ ] Support process defined
- [ ] Backup and recovery tested
- [ ] Rollback plan prepared

### Launch Day

1. **Pre-launch** (1 hour before)
   - [ ] Verify all services running
   - [ ] Check disk space
   - [ ] Review recent logs
   - [ ] Test health endpoint

2. **Launch**
   - [ ] Install app on production store
   - [ ] Complete initial configuration
   - [ ] Test with small CSV first
   - [ ] Monitor logs actively

3. **Post-launch** (first 24 hours)
   - [ ] Monitor error logs
   - [ ] Check PM2 status regularly
   - [ ] Monitor database performance
   - [ ] Monitor OpenRouter usage/costs
   - [ ] Collect user feedback

## Maintenance Schedule

### Daily
- [ ] Check PM2 status
- [ ] Review error logs
- [ ] Monitor disk space

### Weekly
- [ ] Database backup
- [ ] Review OpenRouter costs
- [ ] Check SSL certificate expiry
- [ ] Update dependencies (if needed)

### Monthly
- [ ] Security updates
- [ ] Performance review
- [ ] Cost analysis
- [ ] User feedback review

## Emergency Procedures

### Application Down

```bash
# Check PM2 status
pm2 status

# Restart application
pm2 restart shopify-product-import

# Check logs
pm2 logs shopify-product-import --lines 100
```

### Database Issues

```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### SSL Certificate Expired

```bash
# Renew certificate
sudo certbot renew

# Restart Nginx
sudo systemctl restart nginx
```

### Disk Space Full

```bash
# Check disk usage
df -h

# Clear old logs
pm2 flush
sudo journalctl --vacuum-time=7d

# Clear old backups
rm ~/backups/old_*.sql
```

## Contact Information

**Critical Issues:**
- GitHub Repository: [Your repo URL]
- Team Lead: [Name/Email]
- DevOps: [Name/Email]

**Service Providers:**
- Google Cloud Support: https://cloud.google.com/support
- Shopify Partner Support: https://partners.shopify.com/organizations/
- OpenRouter Support: https://openrouter.ai/support

## Success Criteria

The deployment is successful when:

✅ All checklist items are complete
✅ Application is accessible at https://produktimport.wemarket.dk
✅ Health check returns 200 OK
✅ App installs on Shopify store
✅ Full workflow completes (upload → map → process → import)
✅ Products appear correctly in Shopify
✅ No critical errors in logs
✅ Team can use the application

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Version:** _______________
**Notes:** _______________

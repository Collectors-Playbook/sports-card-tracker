import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import FileService from '../services/fileService';
import AuditService from '../services/auditService';
import { AuthenticatedRequest } from '../types';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 50;

export function createFileRoutes(fileService: FileService, auditService: AuditService): Router {
  const router = Router();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, fileService.getRawDir());
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase();
      const baseName = path.basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type: ${ext}. Allowed: ${IMAGE_EXTENSIONS.join(', ')}`));
      }
    },
  });

  // List raw files
  router.get('/raw', (_req: Request, res: Response) => {
    try {
      const files = fileService.listFiles(fileService.getRawDir());
      res.json(files);
    } catch (error) {
      console.error('Error listing raw files:', error);
      res.status(500).json({ error: 'Failed to list raw files' });
    }
  });

  // List processed files
  router.get('/processed', (_req: Request, res: Response) => {
    try {
      const files = fileService.listFiles(fileService.getProcessedDir());
      res.json(files);
    } catch (error) {
      console.error('Error listing processed files:', error);
      res.status(500).json({ error: 'Failed to list processed files' });
    }
  });

  // Serve a raw file
  router.get('/raw/:filename', (req: Request, res: Response) => {
    const filePath = fileService.getFilePath(fileService.getRawDir(), req.params.filename);
    if (!filePath || !fileService.fileExists(fileService.getRawDir(), req.params.filename)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.sendFile(filePath);
  });

  // Serve a processed file
  router.get('/processed/:filename', (req: Request, res: Response) => {
    const filePath = fileService.getFilePath(fileService.getProcessedDir(), req.params.filename);
    if (!filePath || !fileService.fileExists(fileService.getProcessedDir(), req.params.filename)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.sendFile(filePath);
  });

  // Upload files to raw
  router.post('/raw/upload', upload.array('files', MAX_FILES), (req: AuthenticatedRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const uploaded = files.map(f => ({
      name: f.filename,
      size: f.size,
      originalName: f.originalname,
    }));

    auditService.log(req, { action: 'file.upload', entity: 'file', details: { count: uploaded.length, filenames: uploaded.map(u => u.name) } });
    res.status(201).json({ uploaded, count: uploaded.length });
  });

  // Replace a raw file (used by crop/edit)
  router.put('/raw/:filename', upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
    const existingPath = fileService.getFilePath(fileService.getRawDir(), req.params.filename);
    if (!existingPath || !fileService.fileExists(fileService.getRawDir(), req.params.filename)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    // The uploaded file was saved with a unique suffix by multer.
    // We need to replace the original file with the uploaded content.
    const fs = require('fs');
    try {
      fs.copyFileSync(file.path, existingPath);
      fs.unlinkSync(file.path);
      auditService.log(req, { action: 'file.replace', entity: 'file', entityId: req.params.filename });
      res.json({ name: req.params.filename, size: file.size });
    } catch (error) {
      console.error('Error replacing raw file:', error);
      res.status(500).json({ error: 'Failed to replace file' });
    }
  });

  // Delete a raw file
  router.delete('/raw/:filename', (req: AuthenticatedRequest, res: Response) => {
    const deleted = fileService.deleteFile(fileService.getRawDir(), req.params.filename);
    if (deleted) {
      auditService.log(req, { action: 'file.delete_raw', entity: 'file', entityId: req.params.filename });
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Delete a processed file
  router.delete('/processed/:filename', (req: AuthenticatedRequest, res: Response) => {
    const deleted = fileService.deleteFile(fileService.getProcessedDir(), req.params.filename);
    if (deleted) {
      auditService.log(req, { action: 'file.delete_processed', entity: 'file', entityId: req.params.filename });
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Read a log file
  router.get('/logs/:logname', (req: Request, res: Response) => {
    const validLogs = ['image-error.log', 'comp-error.log'];
    if (!validLogs.includes(req.params.logname)) {
      res.status(400).json({ error: `Invalid log name. Valid: ${validLogs.join(', ')}` });
      return;
    }
    const entries = fileService.readLog(req.params.logname);
    res.json(entries);
  });

  // Clear a log file
  router.delete('/logs/:logname', (req: AuthenticatedRequest, res: Response) => {
    const validLogs = ['image-error.log', 'comp-error.log'];
    if (!validLogs.includes(req.params.logname)) {
      res.status(400).json({ error: `Invalid log name. Valid: ${validLogs.join(', ')}` });
      return;
    }
    fileService.clearLog(req.params.logname);
    auditService.log(req, { action: 'log.clear', entity: 'log', entityId: req.params.logname });
    res.status(204).send();
  });

  return router;
}

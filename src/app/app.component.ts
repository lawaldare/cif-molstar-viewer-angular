import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppFacade } from './app.facade';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {
  @ViewChild('dropArea') dropArea!: ElementRef<HTMLElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('viewer') viewer!: ElementRef<HTMLElement>;

  public facade = inject(AppFacade);

  private plugin: any = null;
  public currentFile: File | null = null;
  // public isLoading = signal(false);
  // public errorMsg = signal('');
  // public successMsg = signal('');

  public modelSym = this.facade.modelSym;
  public modelSymParam = this.facade.modelSymParam;
  public simplifiedSpacegroup = this.facade.simplifiedSpacegroup;
  public orthoCode = this.facade.orthoCode;
  public analysis = this.facade.analysis;
  public label = this.facade.label;

  ngAfterViewInit(): void {
    this.initMolstar();
  }

  /** Browse file button */
  public onBrowseClick(): void {
    this.fileInput.nativeElement.click();
  }

  /** File input change */
  public onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.processFile(input.files[0]);
    }
  }

  /** Drag & drop events */
  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dropArea.nativeElement.style.borderColor = '#2196f3';
    this.dropArea.nativeElement.style.backgroundColor =
      'rgba(33, 150, 243, 0.1)';
  }

  public onDragLeave(): void {
    this.resetDropAreaStyle();
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer?.files.length) {
      this.processFile(event.dataTransfer.files[0]);
    }

    this.resetDropAreaStyle();
  }

  private resetDropAreaStyle(): void {
    this.dropArea.nativeElement.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    this.dropArea.nativeElement.style.backgroundColor = 'transparent';
  }

  /** File processing */
  private processFile(file: File): void {
    const lowerName = file.name.toLowerCase();
    const isCif = lowerName.endsWith('.cif');
    const isEnt = lowerName.endsWith('.ent') || lowerName.endsWith('.pdb');
    if (!isCif && !isEnt) {
      this.facade.showError('Please select a valid .cif or .ent file');
      return;
    }

    this.currentFile = file;
    this.facade.hideError();
    this.facade.showSuccess('File selected successfully. Loading structure...');
    this.loadFileToViewer(file);
  }

  /** Molstar initialization */
  private async initMolstar() {
    try {
      this.facade.showLoading();

      // Assumes Molstar is loaded globally
      this.plugin = await (window as any).molstar.Viewer.create(
        this.viewer.nativeElement,
        {
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowRemoteState: false,
          layoutShowSequence: false,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          collapseLeftPanel: true,
          collapseRightPanel: true,
          viewportShowControls: false,
          canvas3d: { backgroundColor: { r: 0, g: 0, b: 0 } },
        }
      );

      // 🔴 Catch Mol* internal errors here
      this.plugin.plugin.events.log.subscribe((e: any) => {
        if (e.type === 'error') {
          this.facade.showError(`Mol* error: ${e.message}`);
          this.plugin.plugin.clear();
          this.currentFile = null;
          this.facade.hideLoading();
        } else {
          this.facade.showSuccess('Structure loaded successfully');
        }
      });

      this.facade.hideLoading();
    } catch (error) {
      console.error('Error initializing Molstar:', error);
      this.facade.showError('Error initializing Molstar');
    }
  }

  /** Load CIF file to Molstar */
  private async loadFileToViewer(file: File): Promise<void> {
    if (!this.plugin) {
      this.facade.showError('Viewer not initialized');
      return;
    }

    try {
      this.facade.showLoading();
      const fileContent = await this.readFileAsText(file);

      this.plugin.plugin.clear();

      const isCif = file.name.toLowerCase().endsWith('.cif');
      const format = isCif ? 'mmcif' : 'pdb';
      await this.plugin.loadStructureFromData(fileContent, format);

      const data =
        this.plugin.plugin.managers.structure.hierarchy.current.structures[0];
      if (!data) return;

      const model = data.cell?.obj?.data.models?.[0] || data.cell?.obj?.data;
      this.facade.model.set(model);
      if (!model) return;

      const structures =
        this.plugin.plugin.managers.structure.hierarchy.current.structures;
      this.facade.structures.update(() => structures);

      this.facade.hideLoading();
    } catch (error) {
      console.error('Error loading CIF file:', error);
      this.facade.showError(
        'Failed to load the CIF file. Please try another file.'
      );
      this.facade.hideLoading();
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }
}
